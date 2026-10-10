# Translation review: Somali and Arabic

Text is in `src/lib/i18n.tsx` (`so`, `en`, `ar`; English is the reference). The keys starting `adm.`, `cx.`, `rx.`, `mem.` and `phone.`, plus `signin.phoneFull` and `signin.phoneCheck`, were written during development without a native speaker. They were reviewed and corrected where the problem was clear (below), but **all of them need a native speaker's confirmation before release**.

## Corrected (2026-10-10)

| Key(s) | Language | Problem | Now |
|---|---|---|---|
| `rx.goOnline`, `rx.goOffline`, `rx.offlineBody`, `rx.mapOfflineBody`, `mem.onNow`, `mem.confirmFirst`, `mem.confirmAgain`, `mem.blockedBody`, `adm.noOnlineBody`, `cx.noRidersBody`, `rider.offlineBody`, `rider.endedElsewhere` | Arabic | "اتصل" was used for "go online", but it also means "make a phone call", which is confusing in a calling app | "ابدأ العمل" / "أنهِ العمل" (start / end work) |
| `cx.availableNow`, `adm.customerCount`, `adm.matches`, `adm.someNoPosition`, `adm.reportingCount`, `rx.busyLeft`, `mem.until`, `mem.activeLine`, `mem.daysLeft`, `mem.endsSoon`, `mem.savedGrace`, `cx.eta` | Arabic | Number agreement ("{n} متاحون", "بقي {n} يوماً") is wrong for some numbers | Label form: "المتاحون الآن: {n}", "الأيام المتبقية: {n}" |
| `adm.actCustomerJoined`, `adm.actApplied`, `adm.actCall`, `adm.actReset` | Somali, Arabic | Verbs assumed a male subject | Neutral: "Macmiil cusub: {name}", "عميل جديد: {name}" |
| `phone.effectRider`, `phone.effectCustomer` | Somali, Arabic | Assumed a male subject | About "the account" (Somali) / passive (Arabic) |
| `cx.locDeniedBody`, `cx.locOffBody` | Somali | "Inta ka horreysa" (before that) used for "until then" | "Ilaa intaa" |
| `cx.eta` | Somali | "(qiyaas)" repeated "Qiyaastii" | "Qiyaastii {n} daqiiqo" |
| `adm.allClear` | Somali | "Wax walba waa la dhammeeyay" (everything is finished) | "Wax sugaya ma jiro" (nothing waiting) |

## Please confirm with a native speaker

| Key(s) | Language | Question |
|---|---|---|
| `rx.goOnline` "Online noqo", `rx.goOffline` "Ka bax online" | Somali | Do riders say "online/offline", or is "Bilow shaqada" / "Jooji shaqada" clearer? |
| `mem.require` "U baahan xubinnimo lacag leh oo darawal" | Somali | Reads awkwardly; suggestion: "Darawallada ka dalbo xubinnimo lacag leh" |
| `mem.*` "Xubinnimo", "Firfircoon", "Hawlgeli" | Somali | Natural words for membership / active / activate? |
| "{n} maalmood", "{n} daqiiqo" | Somali | Singular forms for 1 ("1 maalin")? |
| Verbs about riders ("wuxuu", "uu") in `rx.*`, `phone.*`, `mem.*` | Somali | Acceptable for riders, or should they be neutral? |
| `cx.title` "ابحث عن دراجة قريبة منك" | Arabic | "دراجة" vs "دراجة نارية" / "موتو" for the moto: which do customers use? |
| Prices "1$" and "$1.00" | Arabic | Prefer "1 دولار"? (amounts come from the app as "$1.00") |
| `adm.reportingOnline` "يُبلغ أنه متصل" | Arabic | Natural for "reporting online"? |
| `mem.*` payment wording (ZAAD, eDahab, reference, receiving account) | Both | Matches what admins and riders call these? |
| Older keys (`signin.*`, `home.*`, `rider.*`, `admin.*`, `rf.*`, `onb.*`) | Both | Written earlier; never reviewed by a native speaker either |

## How to review

Run the staging app (`npm run start:staging`), switch language in Settings (admin), Account (customer and rider) or the sign-in screen, and walk through the screens. Note the key next to each change so it can be edited in `src/lib/i18n.tsx`; every key must exist in all three languages (the typecheck enforces it).
