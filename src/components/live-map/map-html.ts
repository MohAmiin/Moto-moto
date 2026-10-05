// A self-contained Leaflet page with OpenStreetMap tiles. It is shown in a WebView on phones and an
// iframe on the web, and receives data through postMessage: see LiveMapData.

import { ACTIVE_CITY } from '@/lib/service-area';

import { PIN_IMAGE } from './pin-image';

export type MapPoint = { id: string; lat: number; lng: number; title: string; subtitle?: string };

export type LiveMapData = {
  me: { lat: number; lng: number; label: string } | null;
  riders: MapPoint[];
  /** Change this number to fit the view to everyone again (the first update always does). */
  recenter?: number;
  /** The rider picked in the list or on the map; their pin is outlined in orange. */
  selected?: string | null;
};

const B = ACTIVE_CITY.bounds;

export const MAP_HTML = `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html, body, #map { height: 100%; margin: 0; background: #E8E4DE; font-family: -apple-system, system-ui, sans-serif; }
  .me { width: 18px; height: 18px; border-radius: 50%; background: #2F6FED; border: 3px solid #fff; box-shadow: 0 0 0 6px rgba(47,111,237,.25); }
  .rider { width: 38px; height: 38px; border-radius: 50%; background: #fff; border: 3px solid #0046B5; display: grid; place-items: center; box-shadow: 0 2px 6px rgba(0,0,0,.35); }
  .rider img { width: 30px; height: 30px; }
  .rider.on { border-color: #FF6B0A; box-shadow: 0 0 0 4px rgba(255,107,10,.3), 0 2px 6px rgba(0,0,0,.35); }
  .leaflet-popup-content { margin: 10px 12px; font-size: 14px; color: #0046B5; }
  .leaflet-popup-content b { display: block; font-size: 15px; }
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  // The map is locked to the city Jareeye serves: it can't be panned or zoomed out beyond it.
  var city = L.latLngBounds([[${B.south}, ${B.west}], [${B.north}, ${B.east}]]);
  var map = L.map('map', { zoomControl: false, maxBounds: city.pad(0.02), maxBoundsViscosity: 1.0 });
  map.fitBounds(city);
  map.setMinZoom(map.getZoom());
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  var meIcon = L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
  var riderIcon = L.divIcon({ className: '', html: '<div class="rider"><img src="${PIN_IMAGE}" alt=""></div>', iconSize: [38, 38], iconAnchor: [19, 19] });
  var riderOnIcon = L.divIcon({ className: '', html: '<div class="rider on"><img src="${PIN_IMAGE}" alt=""></div>', iconSize: [38, 38], iconAnchor: [19, 19] });
  // Tells the app which rider was tapped, so it can show that rider's card.
  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    else if (window.parent) window.parent.postMessage('jareeye-map-' + msg, '*');
  }
  var me = null, riders = {}, fitted = false, lastRecenter = 0;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function update(d) {
    if (d.me) {
      if (!me) me = L.marker([d.me.lat, d.me.lng], { icon: meIcon, zIndexOffset: 1000 }).addTo(map).bindTooltip(esc(d.me.label));
      else me.setLatLng([d.me.lat, d.me.lng]);
    }
    var seen = {};
    (d.riders || []).forEach(function (r) {
      seen[r.id] = true;
      var html = '<b>' + esc(r.title) + '</b>' + esc(r.subtitle);
      var icon = d.selected === r.id ? riderOnIcon : riderIcon;
      if (riders[r.id]) riders[r.id].setLatLng([r.lat, r.lng]).setPopupContent(html).setIcon(icon).setZIndexOffset(d.selected === r.id ? 500 : 0);
      else riders[r.id] = L.marker([r.lat, r.lng], { icon: icon }).addTo(map).bindPopup(html).on('click', (function (id) { return function () { post('select:' + id); }; })(r.id));
    });
    Object.keys(riders).forEach(function (id) { if (!seen[id]) { map.removeLayer(riders[id]); delete riders[id]; } });
    if (!fitted || (d.recenter && d.recenter !== lastRecenter)) {
      lastRecenter = d.recenter || lastRecenter;
      var pts = Object.keys(riders).map(function (id) { return riders[id].getLatLng(); });
      if (me) pts.push(me.getLatLng());
      if (pts.length === 1) { map.setView(pts[0], 15); fitted = true; }
      else if (pts.length > 1) { map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 16 }); fitted = true; }
    }
  }
  function receive(e) { try { update(typeof e.data === 'string' ? JSON.parse(e.data) : e.data); } catch (err) {} }
  window.addEventListener('message', receive);
  document.addEventListener('message', receive);
  window.update = update;
  // Tell the app the map is ready for data.
  post('ready');
</script>
</body></html>`;
