import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

export type Language = 'so' | 'en' | 'ar';

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'so', label: 'Soomaali' },
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
];

// Somali lists every key; English (the default) and Arabic must match it exactly.
// Arabic is right to left; wrap Latin-script numbers so they keep their order inside Arabic sentences.
export const LTR = '\u2066';
export const PDI = '\u2069';

const so = {
  // Common
  'common.signOut': 'Ka bax',
  'common.back': 'Dib u noqo',
  'common.add': 'Ku dar',
  'common.addOne': 'Ku dar mid',
  'common.removeOne': 'Ka yaree',
  'common.phone': 'Lambarka taleefanka',
  'common.phoneShort': 'Taleefan',
  'common.name': 'Magaca',
  'common.plate': 'Taarikada',
  'common.district': 'Xaafadda',
  'common.deliveryBadge': 'Geyn $1',
  'common.language': 'Luqadda',

  // Errors
  'err.notApproved': 'Weli lagu ma ansixin.',
  'err.badCode': 'Koodhku waa khalad ama wuu dhacay.',
  'err.smsFailed': 'Fariinta SMS lama diri karin. Hubi lambarka oo mar kale isku day.',
  'err.generic': 'Wax khalad ah ayaa dhacay. Fadlan mar kale isku day.',

  // Sign in
  'signin.headline': 'Wax kasta ku dir magaalada adigoo isticmaalaya mooto.',
  'signin.sub': 'Hel mooto kuu dhow oo wac ilbiriqsiyo gudahood.',
  'signin.badge': 'Geyn $1 meel kasta',
  'signin.invalidPhone': 'Fadlan geli lambar sax ah, tusaale 63 123 4567',
  'signin.smsNote': 'Koodh SMS ah ayaan kuu soo diri doonnaa si aad u xaqiijiso lambarkaaga.',
  'signin.send': 'Dir koodhka',
  'signin.both': 'Macmiil iyo darawal mooto labaduba halkan ayey ka galaan.',

  // Verify
  'verify.title': 'Geli koodhka',
  'verify.sentTo': 'Waxaan u dirnay {phone}',
  'verify.label': 'Koodhka SMS-ka',
  'verify.sixDigits': 'Koodhku waa 6 lambar',
  'verify.confirm': 'Xaqiiji',
  'verify.resent': 'Koodh cusub ayaa laguu diray.',
  'verify.resend': 'Koodh cusub ii soo dir',
  'verify.changeNumber': 'Beddel lambarka',

  // Onboarding
  'onb.welcome': 'Ku soo dhawoow Jareeye',
  'onb.how': 'Sidee u isticmaalaysaa app-ka?',
  'onb.customerTitle': 'Waxaan ahay macmiil',
  'onb.customerBody': 'Hel mooto kuu dhow, una dir xirmo meel kasta oo magaalada ah.',
  'onb.riderTitle': 'Waxaan ahay darawal mooto',
  'onb.riderBody': 'Qaado dalabyo, hel $1 safar kasta. Waxaan hubineynaa aqoonsigaaga ka hor intaadan bilaabin.',
  'onb.choose': 'Dooro',
  'onb.detailsTitle': 'Macluumaadkaaga',
  'onb.detailsSub': 'Nala sheeg magacaaga iyo halka aan wax kuugu keenno.',
  'onb.yourName': 'Magacaaga',
  'onb.namePh': 'tus. Hodan Axmed',
  'onb.nameRequired': 'Fadlan geli magacaaga',
  'onb.yourDistrict': 'Xaafadda aad joogto',
  'onb.changeLater': 'Waad beddeli kartaa cinwaanka mar kasta oo aad dalbanayso.',
  'onb.start': 'Bilow',
  'onb.riderRegisterTitle': 'Is diiwaan geli sida darawal mooto',
  'onb.riderRegisterSub': 'Waxaan u baahanahay inaan hubinno cidda aad tahay. Macaamiishu waxay arkaan magacaaga iyo taarikada mootada.',

  // Rider application form
  'rf.fullName': 'Magaca oo buuxa',
  'rf.fullNamePh': 'tus. Cabdi Xasan Faarax',
  'rf.idNumber': 'Lambarka aqoonsiga',
  'rf.idPh': 'tus. 1234567',
  'rf.plate': 'Taarikada mootada',
  'rf.platePh': 'tus. MT 214',
  'rf.workDistrict': 'Xaafadda aad ka shaqeyso',
  'rf.idPhoto': 'Sawirka kaarka aqoonsiga',
  'rf.photoChosen': 'Sawirka waa la doortay',
  'rf.photoExists': 'Sawir hore ayaa jira',
  'rf.photoAdd': 'Sawir ku soo geli',
  'rf.photoChange': 'Riix si aad u beddesho',
  'rf.photoHint': 'Kaarka aqoonsiga ama baasaboorka',
  'rf.agree': 'Waxaan oggolahay shuruudaha Jareeye, waxaanan leeyahay mooto iyo liisan wadis.',
  'rf.missingFields': 'Fadlan buuxi magaca, lambarka aqoonsiga iyo taarikada',
  'rf.missingPhoto': 'Fadlan soo geli sawirka kaarka aqoonsiga',
  'rf.mustAgree': 'Fadlan oggolow shuruudaha',
  'rf.submit': 'Gudbi codsiga',

  // Customer tabs and home
  'tab.home': 'Hoyga',
  'tab.account': 'Akoon',

  // Account
  'acct.title': 'Akoonkayga',
  'acct.deliveryDistrict': 'Xaafadda geynta',
  'acct.addressChanged': 'Cinwaanka waa la beddelay',

  // Rider
  'rider.completeTitle': 'Dhammaystir codsigaaga',
  'rider.completeSub': 'Waxaan u baahanahay macluumaadka mootadaada ka hor intaadan bilaabin.',
  'rider.rejectedTitle': 'Codsigaaga lama aqbalin',
  'rider.rejectedSub': 'Hubi macluumaadka oo mar kale soo gudbi, ama la xiriir xafiiska Jareeye.',
  'rider.pendingTitle': 'Codsigaaga waa la helay',
  'rider.pendingBody': 'Kooxdayadu waxay hubin doontaa aqoonsigaaga iyo mootadaada. Boggan wuu is beddeli doonaa marka lagu ansixiyo.',
  'rider.online': 'Online',
  'rider.offline': 'Offline',
  'rider.offlineTitle': 'Waxaad tahay offline',

  // Admin
  'admin.title': 'Maamulka Jareeye',
  'admin.sub': 'Ansixi darawallada mootada, arag kuwa online ah.',
  'admin.pending': 'Sugaya',
  'admin.approved': 'La ansixiyay',
  'admin.rejected': 'La diiday',
  'admin.noApplications': 'Codsi ma jiro',
  'admin.idPhoto': 'Sawirka aqoonsiga',
  'admin.idLine': 'Aqoonsi: {id} · Taarikada: {plate}',
  'admin.districtLine': 'Xaafadda: {d} · {date}',
  'admin.approve': 'Ansixi',
  'admin.reject': 'Diid',

  // Find a rider
  'home.title': 'Mootooyinka kuu dhow',
  'home.sub': 'Mootooyinka online ah ee kuu dhow. Wac mid, u dhiib xirmadaada, una sheeg halka uu geynayo.',
  'home.locationOn': 'Waxaa lagu tusayaa mootooyinka kuugu dhow',
  'home.locationOff': 'Shid goobta si aad u aragto mootooyinka kuugu dhow marka hore',
  'home.useLocation': 'Isticmaal goobtayda',
  'home.noRiders': 'Hadda mooto online ah ma jirto',
  'home.noRidersBody': 'Mar kale eeg dhowr daqiiqo kadib.',
  'home.kmAway': '{km} km u jira',
  'home.mAway': '{m} m u jira',
  'home.inArea': 'Wuxuu joogaa {area}',
  'home.call': 'Wac',
  'home.howTitle': 'Sida ay u shaqeyso',
  'home.how1': 'Wac mootada kuugu dhow.',
  'home.how2': 'U dhiib xirmada, una sii lambarka qofka qaadanaya.',
  'home.how3': 'Darawalku wuu wacayaa qofka, wuuna u geynayaa. Lacagta si toos ah u sii darawalka.',
  'rider.onlineTitle': 'Waxaad tahay online',
  'rider.onlineBody': 'Dadka kuu dhow way ku arki karaan, waxayna kuugu soo wici karaan {phone}. App-ka furan ku hay.',
  'rider.offlineBody': 'Noqo online si dadka kuu dhow ay kuu helaan oo kuu soo wacaan.',
  'rider.locationShared': 'Goobtaada waa la wadaagayaa',
  'rider.locationDenied': 'Goobta waa xiran tahay. Dadku waxay arki doonaan xaafaddaada oo keliya.',
  'rider.currentArea': 'Xaggee joogtaa hadda?',
  'rider.tips': 'Marka lagu soo waco: la kulan, qaado xirmada iyo lambarka qofka qaadanaya, kadibna geey.',
  'admin.online': 'Online hadda',
  'admin.noOnline': 'Mooto online ah ma jirto',
  'map.you': 'Adiga',
  'map.showAll': 'Muuji dhammaan',
  'map.live': 'Toos · wuxuu cusboonaanayaa 15 ilbiriqsi kasta',
  'city.hargeisa': 'Hargeysa',
  'area.outside': 'Jareeye wuxuu hadda ka shaqeeyaa {city} oo keliya. Waxaad joogtaa meel ka baxsan magaalada.',
  'area.outsideRider': 'Waxaad joogtaa meel ka baxsan {city}. Macaamiishu kuma arki doonaan ilaa aad magaalada ku soo laabato.',
  // Trust: photo, Jareeye number, busy, ratings
  'common.saving': 'Waa la keydinayaa…',
  'rf.facePhoto': 'Sawirkaaga',
  'rf.faceHint': 'Sawir cad oo wejigaaga ah. Macaamiishu way arki doonaan.',
  'rf.missingFace': 'Fadlan ku dar sawirkaaga',
  'rating.value': '★ {rating} ({count})',
  'rating.new': 'Cusub',
  'rider.busy': 'Mashquul',
  'rider.goBusy': 'Waxaan wadaa dalab',
  'rider.goFree': 'Waan firaaqoobay',
  'rider.busyTitle': 'Waad mashquul tahay',
  'rider.busyBody': 'Dadku kuma arkaan ilaa {time}, ama ilaa aad riixdo "Waan firaaqoobay".',
  'rider.addPhotoTitle': 'Ku dar sawirkaaga',
  'rider.addPhotoBody': 'Macaamiishu waxay ku kalsoon yihiin darawalka ay arkaan. Ku dar sawir cad oo wejigaaga ah.',
  'rider.addPhoto': 'Dooro sawir',
  'rider.changePhoto': 'Beddel sawirkaaga',
  'rate.title': 'Sidee ahaa {name}?',
  'rate.sub': 'Qiimayntaadu waxay dadka kale ka caawisaa inay doortaan darawal wanaagsan.',
  'rate.stars': '{n} xiddig',
  'rate.skip': 'Ka gudub',
  'rate.thanks': 'Mahadsanid qiimayntaada!',
  'admin.stats': 'Wicitaan: {calls} · Qiimeyn: {rating}',
  'admin.noRating': 'weli lama qiimeyn',
};

export type TKey = keyof typeof so;
type Dictionary = Record<TKey, string>;

const en: Dictionary = {
  'common.signOut': 'Sign out',
  'common.back': 'Back',
  'common.add': 'Add',
  'common.addOne': 'Add one',
  'common.removeOne': 'Remove one',
  'common.phone': 'Phone number',
  'common.phoneShort': 'Phone',
  'common.name': 'Name',
  'common.plate': 'Plate',
  'common.district': 'Neighbourhood',
  'common.deliveryBadge': '$1 delivery',
  'common.language': 'Language',

  'err.notApproved': "You haven't been approved yet.",
  'err.badCode': 'The code is wrong or has expired.',
  'err.smsFailed': "We couldn't send the SMS. Check the number and try again.",
  'err.generic': 'Something went wrong. Please try again.',

  'signin.headline': 'Send anything across the city by moto.',
  'signin.sub': 'Find a moto near you and call in seconds.',
  'signin.badge': '$1 delivery anywhere',
  'signin.invalidPhone': 'Enter a valid number, for example 63 123 4567',
  'signin.smsNote': "We'll text you a code to confirm your number.",
  'signin.send': 'Send code',
  'signin.both': 'Customers and moto drivers both sign in here.',

  'verify.title': 'Enter the code',
  'verify.sentTo': 'We sent it to {phone}',
  'verify.label': 'SMS code',
  'verify.sixDigits': 'The code has 6 digits',
  'verify.confirm': 'Confirm',
  'verify.resent': 'A new code is on its way.',
  'verify.resend': 'Send me a new code',
  'verify.changeNumber': 'Change number',

  'onb.welcome': 'Welcome to Jareeye',
  'onb.how': 'How will you use the app?',
  'onb.customerTitle': "I'm a customer",
  'onb.customerBody': 'Find a moto near you and send a package anywhere in the city.',
  'onb.riderTitle': "I'm a moto driver",
  'onb.riderBody': 'Take deliveries and earn $1 per trip. We check your ID before you start.',
  'onb.choose': 'Choose',
  'onb.detailsTitle': 'Your details',
  'onb.detailsSub': 'Tell us your name and where we should deliver.',
  'onb.yourName': 'Your name',
  'onb.namePh': 'e.g. Hodan Ahmed',
  'onb.nameRequired': 'Please enter your name',
  'onb.yourDistrict': 'Your neighbourhood',
  'onb.changeLater': 'You can change your address every time you order.',
  'onb.start': 'Start',
  'onb.riderRegisterTitle': 'Register as a moto driver',
  'onb.riderRegisterSub': 'We need to check who you are. Customers see your name and bike plate.',

  'rf.fullName': 'Full name',
  'rf.fullNamePh': 'e.g. Abdi Hassan Farah',
  'rf.idNumber': 'ID number',
  'rf.idPh': 'e.g. 1234567',
  'rf.plate': 'Bike plate',
  'rf.platePh': 'e.g. MT 214',
  'rf.workDistrict': 'Neighbourhood you work in',
  'rf.idPhoto': 'Photo of your ID card',
  'rf.photoChosen': 'Photo selected',
  'rf.photoExists': 'A photo is already on file',
  'rf.photoAdd': 'Add a photo',
  'rf.photoChange': 'Tap to change',
  'rf.photoHint': 'ID card or passport',
  'rf.agree': 'I agree to the Jareeye terms, and I have a motorbike and a driving licence.',
  'rf.missingFields': 'Please fill in your name, ID number and plate',
  'rf.missingPhoto': 'Please add a photo of your ID card',
  'rf.mustAgree': 'Please accept the terms',
  'rf.submit': 'Submit application',

  'tab.home': 'Home',
  'tab.account': 'Account',

  'acct.title': 'My account',
  'acct.deliveryDistrict': 'Delivery neighbourhood',
  'acct.addressChanged': 'Address updated',

  'rider.completeTitle': 'Complete your application',
  'rider.completeSub': 'We need your bike details before you start.',
  'rider.rejectedTitle': 'Your application was not approved',
  'rider.rejectedSub': 'Check your details and submit again, or contact the Jareeye office.',
  'rider.pendingTitle': "We've received your application",
  'rider.pendingBody': "Our team will check your ID and bike. This page updates as soon as you're approved.",
  'rider.online': 'Online',
  'rider.offline': 'Offline',
  'rider.offlineTitle': "You're offline",

  'admin.title': 'Jareeye admin',
  'admin.sub': 'Approve moto drivers and see who is online.',
  'admin.pending': 'Pending',
  'admin.approved': 'Approved',
  'admin.rejected': 'Rejected',
  'admin.noApplications': 'No applications',
  'admin.idPhoto': 'ID photo',
  'admin.idLine': 'ID: {id} · Plate: {plate}',
  'admin.districtLine': 'Neighbourhood: {d} · {date}',
  'admin.approve': 'Approve',
  'admin.reject': 'Reject',

  'home.title': 'Motos near you',
  'home.sub': 'Motos online near you. Call one, hand over your package and say where it goes.',
  'home.locationOn': 'Showing the motos nearest to you',
  'home.locationOff': 'Turn on location to see the nearest motos first',
  'home.useLocation': 'Use my location',
  'home.noRiders': 'No motos online right now',
  'home.noRidersBody': 'Check again in a few minutes.',
  'home.kmAway': '{km} km away',
  'home.mAway': '{m} m away',
  'home.inArea': 'In {area}',
  'home.call': 'Call',
  'home.howTitle': 'How it works',
  'home.how1': 'Call the nearest moto.',
  'home.how2': 'Hand over the package and give the receiver\'s phone number.',
  'home.how3': 'The driver calls the receiver and delivers. Pay the driver directly.',
  'rider.onlineTitle': 'You\'re online',
  'rider.onlineBody': 'People nearby can see you and call you on {phone}. Keep the app open.',
  'rider.offlineBody': 'Go online so people nearby can find and call you.',
  'rider.locationShared': 'Sharing your location',
  'rider.locationDenied': 'Location is off. People will only see your neighbourhood.',
  'rider.currentArea': 'Where are you now?',
  'rider.tips': 'When someone calls: meet them, take the package and the receiver\'s number, then deliver.',
  'admin.online': 'Online now',
  'admin.noOnline': 'No motos online',
  'map.you': 'You',
  'map.showAll': 'Show everyone',
  'map.live': 'Live · updates every 15 seconds',
  'city.hargeisa': 'Hargeisa',
  'area.outside': "Jareeye works in {city} only for now. You're outside the city.",
  'area.outsideRider': "You're outside {city}. Customers won't see you until you're back in the city.",
  'common.saving': 'Saving…',
  'rf.facePhoto': 'Your photo',
  'rf.faceHint': 'A clear photo of your face. Customers will see it.',
  'rf.missingFace': 'Please add your photo',
  'rating.value': '★ {rating} ({count})',
  'rating.new': 'New',
  'rider.busy': 'Busy',
  'rider.goBusy': "I'm on a delivery",
  'rider.goFree': "I'm free again",
  'rider.busyTitle': "You're busy",
  'rider.busyBody': 'Customers won\'t see you until {time}, or until you tap "I\'m free again".',
  'rider.addPhotoTitle': 'Add your photo',
  'rider.addPhotoBody': 'Customers trust drivers they can see. Add a clear photo of your face.',
  'rider.addPhoto': 'Choose a photo',
  'rider.changePhoto': 'Change your photo',
  'rate.title': 'How was {name}?',
  'rate.sub': 'Your rating helps others choose good drivers.',
  'rate.stars': '{n} stars',
  'rate.skip': 'Skip',
  'rate.thanks': 'Thanks for your rating!',
  'admin.stats': 'Calls: {calls} · Rating: {rating}',
  'admin.noRating': 'no ratings yet',
};

const ar: Dictionary = {
  'common.signOut': 'تسجيل الخروج',
  'common.back': 'رجوع',
  'common.add': 'أضف',
  'common.addOne': 'إضافة واحد',
  'common.removeOne': 'إزالة واحد',
  'common.phone': 'رقم الهاتف',
  'common.phoneShort': 'الهاتف',
  'common.name': 'الاسم',
  'common.plate': 'اللوحة',
  'common.district': 'الحي',
  'common.deliveryBadge': `توصيل بـ ${LTR}$1${PDI}`,
  'common.language': 'اللغة',

  'err.notApproved': 'لم تتم الموافقة عليك بعد.',
  'err.badCode': 'الرمز غير صحيح أو منتهي الصلاحية.',
  'err.smsFailed': 'تعذر إرسال الرسالة النصية. تحقق من الرقم وحاول مرة أخرى.',
  'err.generic': 'حدث خطأ ما. يرجى المحاولة مرة أخرى.',

  'signin.headline': 'أرسل أي شيء عبر المدينة بدراجة نارية.',
  'signin.sub': 'اعثر على دراجة قريبة منك واتصل خلال ثوانٍ.',
  'signin.badge': `توصيل بـ ${LTR}$1${PDI} لأي مكان`,
  'signin.invalidPhone': `أدخل رقماً صحيحاً، مثل ${LTR}63 123 4567${PDI}`,
  'signin.smsNote': 'سنرسل لك رمزاً في رسالة نصية لتأكيد رقمك.',
  'signin.send': 'أرسل الرمز',
  'signin.both': 'يسجّل العملاء والسائقون الدخول من هنا.',

  'verify.title': 'أدخل الرمز',
  'verify.sentTo': 'أرسلناه إلى {phone}',
  'verify.label': 'رمز الرسالة',
  'verify.sixDigits': 'الرمز مكوّن من 6 أرقام',
  'verify.confirm': 'تأكيد',
  'verify.resent': 'تم إرسال رمز جديد.',
  'verify.resend': 'أرسل لي رمزاً جديداً',
  'verify.changeNumber': 'تغيير الرقم',

  'onb.welcome': 'مرحباً بك في Jareeye',
  'onb.how': 'كيف ستستخدم التطبيق؟',
  'onb.customerTitle': 'أنا عميل',
  'onb.customerBody': 'اعثر على دراجة قريبة منك وأرسل طرداً إلى أي مكان في المدينة.',
  'onb.riderTitle': 'أنا سائق دراجة نارية',
  'onb.riderBody': `استلم الطلبات واكسب ${LTR}$1${PDI} عن كل رحلة. نتحقق من هويتك قبل أن تبدأ.`,
  'onb.choose': 'اختر',
  'onb.detailsTitle': 'بياناتك',
  'onb.detailsSub': 'أخبرنا باسمك وأين نوصل طلباتك.',
  'onb.yourName': 'اسمك',
  'onb.namePh': 'مثال: هودن أحمد',
  'onb.nameRequired': 'يرجى إدخال اسمك',
  'onb.yourDistrict': 'الحي الذي تسكن فيه',
  'onb.changeLater': 'يمكنك تغيير عنوانك في كل طلب.',
  'onb.start': 'ابدأ',
  'onb.riderRegisterTitle': 'سجّل كسائق',
  'onb.riderRegisterSub': 'نحتاج إلى التحقق من هويتك. يرى العملاء اسمك ولوحة دراجتك.',

  'rf.fullName': 'الاسم الكامل',
  'rf.fullNamePh': 'مثال: عبدي حسن فارح',
  'rf.idNumber': 'رقم الهوية',
  'rf.idPh': 'مثال: 1234567',
  'rf.plate': 'لوحة الدراجة',
  'rf.platePh': 'مثال: MT 214',
  'rf.workDistrict': 'الحي الذي تعمل فيه',
  'rf.idPhoto': 'صورة بطاقة الهوية',
  'rf.photoChosen': 'تم اختيار الصورة',
  'rf.photoExists': 'توجد صورة سابقة',
  'rf.photoAdd': 'أضف صورة',
  'rf.photoChange': 'اضغط للتغيير',
  'rf.photoHint': 'بطاقة الهوية أو جواز السفر',
  'rf.agree': 'أوافق على شروط Jareeye، ولدي دراجة نارية ورخصة قيادة.',
  'rf.missingFields': 'يرجى إدخال الاسم ورقم الهوية ولوحة الدراجة',
  'rf.missingPhoto': 'يرجى إضافة صورة بطاقة الهوية',
  'rf.mustAgree': 'يرجى الموافقة على الشروط',
  'rf.submit': 'أرسل طلب الانضمام',

  'tab.home': 'الرئيسية',
  'tab.account': 'الحساب',

  'acct.title': 'حسابي',
  'acct.deliveryDistrict': 'حي التوصيل',
  'acct.addressChanged': 'تم تحديث العنوان',

  'rider.completeTitle': 'أكمل طلب الانضمام',
  'rider.completeSub': 'نحتاج بيانات دراجتك قبل أن تبدأ.',
  'rider.rejectedTitle': 'لم تتم الموافقة على طلبك',
  'rider.rejectedSub': 'راجع بياناتك وأعد الإرسال، أو تواصل مع مكتب Jareeye.',
  'rider.pendingTitle': 'استلمنا طلبك',
  'rider.pendingBody': 'سيتحقق فريقنا من هويتك ودراجتك. ستتحدث هذه الصفحة فور الموافقة عليك.',
  'rider.online': 'متصل',
  'rider.offline': 'غير متصل',
  'rider.offlineTitle': 'أنت غير متصل',

  'admin.title': 'إدارة Jareeye',
  'admin.sub': 'وافق على السائقين وتابع المتصلين.',
  'admin.pending': 'قيد المراجعة',
  'admin.approved': 'مقبول',
  'admin.rejected': 'مرفوض',
  'admin.noApplications': 'لا توجد طلبات انضمام',
  'admin.idPhoto': 'صورة الهوية',
  'admin.idLine': 'الهوية: {id} · اللوحة: {plate}',
  'admin.districtLine': 'الحي: {d} · {date}',
  'admin.approve': 'قبول',
  'admin.reject': 'رفض',

  'home.title': 'دراجات قريبة منك',
  'home.sub': 'الدراجات المتصلة بالقرب منك. اتصل بإحداها، وسلّم الطرد، وأخبر السائق إلى أين يوصله.',
  'home.locationOn': 'نعرض أقرب الدراجات إليك',
  'home.locationOff': 'فعّل الموقع لترى أقرب الدراجات أولاً',
  'home.useLocation': 'استخدم موقعي',
  'home.noRiders': 'لا توجد دراجات متصلة الآن',
  'home.noRidersBody': 'تحقق مرة أخرى بعد بضع دقائق.',
  'home.kmAway': 'على بعد {km} كم',
  'home.mAway': 'على بعد {m} م',
  'home.inArea': 'في {area}',
  'home.call': 'اتصال',
  'home.howTitle': 'كيف يعمل',
  'home.how1': 'اتصل بأقرب دراجة.',
  'home.how2': 'سلّمه الطرد وأعطه رقم هاتف المستلم.',
  'home.how3': 'يتصل السائق بالمستلم ويوصل الطرد. ادفع للسائق مباشرة.',
  'rider.onlineTitle': 'أنت متصل',
  'rider.onlineBody': 'يستطيع الناس القريبون رؤيتك والاتصال بك على {phone}. أبقِ التطبيق مفتوحاً.',
  'rider.offlineBody': 'اتصل ليجدك الناس القريبون ويتصلوا بك.',
  'rider.locationShared': 'تتم مشاركة موقعك',
  'rider.locationDenied': 'الموقع متوقف. سيرى الناس حيّك فقط.',
  'rider.currentArea': 'أين أنت الآن؟',
  'rider.tips': 'عندما يتصل بك أحد: قابله، واستلم الطرد ورقم المستلم، ثم وصّله.',
  'admin.online': 'متصلون الآن',
  'admin.noOnline': 'لا توجد دراجات متصلة',
  'map.you': 'أنت',
  'map.showAll': 'عرض الجميع',
  'map.live': 'مباشر · يتحدث كل 15 ثانية',
  'city.hargeisa': 'هرجيسا',
  'area.outside': 'يعمل Jareeye في {city} فقط حالياً. أنت خارج المدينة.',
  'area.outsideRider': 'أنت خارج {city}. لن يراك العملاء حتى تعود إلى المدينة.',
  'common.saving': 'جارٍ الحفظ…',
  'rf.facePhoto': 'صورتك',
  'rf.faceHint': 'صورة واضحة لوجهك. سيراها العملاء.',
  'rf.missingFace': 'يرجى إضافة صورتك',
  'rating.value': `★ ${LTR}{rating}${PDI} (${LTR}{count}${PDI})`,
  'rating.new': 'جديد',
  'rider.busy': 'مشغول',
  'rider.goBusy': 'أنا في توصيلة',
  'rider.goFree': 'أنا متاح الآن',
  'rider.busyTitle': 'أنت مشغول',
  'rider.busyBody': `لن يراك العملاء حتى ${LTR}{time}${PDI}، أو حتى تضغط "أنا متاح الآن".`,
  'rider.addPhotoTitle': 'أضف صورتك',
  'rider.addPhotoBody': 'يثق العملاء بالسائق الذي يرونه. أضف صورة واضحة لوجهك.',
  'rider.addPhoto': 'اختر صورة',
  'rider.changePhoto': 'غيّر صورتك',
  'rate.title': 'كيف كان {name}؟',
  'rate.sub': 'تقييمك يساعد الآخرين على اختيار سائقين جيدين.',
  'rate.stars': `${LTR}{n}${PDI} نجوم`,
  'rate.skip': 'تخطَّ',
  'rate.thanks': 'شكراً على تقييمك!',
  'admin.stats': 'المكالمات: {calls} · التقييم: {rating}',
  'admin.noRating': 'لا تقييمات بعد',
};

const DICTIONARIES: Record<Language, Dictionary> = { so, en, ar };
const STORAGE_KEY = 'jareeye.language';

export type Translate = (key: TKey, vars?: Record<string, string | number>) => string;

type I18nState = {
  ready: boolean;
  language: Language;
  isRTL: boolean;
  /** BCP 47 tag for dates and numbers. */
  locale: string;
  setLanguage: (language: Language) => void;
  t: Translate;
};

const I18nContext = createContext<I18nState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'so' || saved === 'en' || saved === 'ar') setLanguageState(saved);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const isRTL = language === 'ar';

  // On web the page direction drives layout; native screens get `direction` from the root layout.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
    }
  }, [language, isRTL]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<I18nState>(() => {
    const dict = DICTIONARIES[language];
    const t: Translate = (key, vars) => {
      let text = dict[key] ?? so[key] ?? key;
      if (vars) for (const [name, v] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(v));
      return text;
    };
    return { ready, language, isRTL, locale: language === 'so' ? 'so-SO' : language === 'ar' ? 'ar' : 'en-GB', setLanguage, t };
  }, [ready, language, isRTL, setLanguage]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n() {
  const value = use(I18nContext);
  if (!value) throw new Error('useI18n must be used inside LanguageProvider');
  return value;
}
