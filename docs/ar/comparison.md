<div dir="rtl" lang="ar">

# مقارنة أنظمة إدارة التأشير على التلفاز

[English](../comparison.md) · [دليل التوثيق](README.md)

## ماذا يضيف إطار؟

يخبر إطار تطبيق React Native TV بالبطاقة التي نقلت المنصّة التأشير إليها فعلًا. يحدّد التطبيق البطاقة بمفتاح ثابت ويطلب نقل التأشير إليها، ثم يتلقّى نتيجة يبني عليها تصرّفه أو يلغي الطلب. ويشغّل مثال Cinema المحرّك نفسه في المتصفّح عبر موائم DOM/Wasm.

فتح مشاهد تفاصيل فيلم من صفّ «شاهد مجدّدًا»، والفيلم نفسه ظاهر أيضًا في صفّ «مختارات». أثناء عرض التفاصيل، تغيّر ترتيب صفّ «شاهد مجدّدًا»، وصارت البطاقة القديمة تعرض فيلمًا آخر. عند الضغط على زرّ الرجوع يحتاج التطبيق إلى إجابتين. من أيّ ظهور للفيلم فُتحت التفاصيل؟ وهل نقل النظام التأشير فعلًا إلى البطاقة التي تمثّل ذلك الظهور الآن؟

- **العودة إلى الظهور نفسه بعد تغيّر الترتيب.** أعطِ كلّ ظهور للفيلم مفتاحًا مختلفًا. يستطيع إطار إحضار الظهور المطلوب إلى الجزء المرئي من القائمة، ويرفض القياس أو تأكيد التأشير إذا كان يعود إلى تركيب سابق لعنصر العرض. [اختبارات الهوية](../../core/tests/identity.cpp) · [اختبارات الإظهار وإعادة التركيب](../../core/tests/transaction_reveal.cpp)
- **تأكيد وصول التأشير وإلغاء الطلب أثناء تنفيذه.** تعيد `focusByKey` طلبًا يتيح `result` و`cancel()`. يبقى الطلب معلّقًا إذا قبلت المنصّة العملية. وحين ترصد وصول تأشير الإدخال إلى الهدف المطابق، يكتمل الطلب بالنتيجة `applied`. قد يُحدِّث إشعار متأخّر من المنصّة موضع التأشير المرصود، مع بقاء الطلب الملغى على حاله. من بين الأنظمة الأربعة في الجدول، إطار هو الوحيد الذي يبيّن أمر التأشير فيه هل وصل تأشير المنصّة إلى الهدف، وهو الوحيد الذي يعيد طلبًا يمكن إلغاؤه. [اختبارات نتائج الطلب](../../core/tests/transaction_outcome.cpp) · [اختبارات الإلغاء](../../core/tests/transaction_cancel.cpp) · [اختبارات واجهة React](../../scripts/react-api.test.cjs)
- **رصد تأشير جهاز التحكّم وتأشير قارئ الشاشة كلًّا على حدة.** يستطيع قارئ الشاشة تفعيل بطاقة تختلف عن البطاقة التي تستقبل إدخال جهاز التحكّم. لا يؤدّي حدث تأشير خاصّ بإمكانية الوصول إلى إكمال طلب معلّق لنقل تأشير الإدخال. ويُبلغ موائم المتصفّح بأنّ موضع تأشير قارئ الشاشة غير معلوم. [اختبارات قناتَي التأشير](../../core/tests/transaction_outcome.cpp) · [اختبارات التأشير والتفعيل في DOM](../../apps/probe/web/tests/focus.test.cjs)
- **تنفيذ التنقّل بين العناصر المعروضة في الطبقة الأصلية.** على Android يُنفَّذ التنقّل المدعوم بالأسهم وتُرسم علامة التأشير على البطاقات خارج خيط JavaScript الذي يستخدمه React. على tvOS يتولّى UIKit التنقّل المعتاد بين العناصر المركّبة. ينفّذ موائم الويب سياسة C++ بصيغة Wasm على خيط المتصفّح ويرصد تأشير DOM. [اختبارات التنقّل على Android](../../packages/itar/android/tests/support/OrderedFocusChecks.kt) · [اختبارات التمييز المرئي](../../packages/itar/android/tests/support/StyleChecks.kt) · [مسؤولية كل طبقة](guides/architecture.md#مسؤولية-كل-طبقة)
- **إعادة إنتاج مشكلة ناجمة عن ترتيب الأحداث على حاسوب التطوير.** مرّر إلى نواة C++ تسلسل التغييرات نفسه في المجموعة وإشعارات المنصّة بالترتيب نفسه، ثم اختبر الحالة الناتجة من دون تشغيل React أو محاكي تلفاز. [اختبار إعادة تشغيل الأحداث](../../core/tests/transaction_replay.cpp)

## حدود النسخة التجريبية

- **التثبيت والمتصفّحات.** يضمّ الأرشيف المحلي `0.1.0-beta` موائم التطبيقات الأصلية `itar/react` وموائم الويب `itar/web` مع المحرّك المترجَم إلى Wasm. يستهدف بناء JavaScript وبناء Wasm الإصدار Chrome 85. تقع المحرّكات الأقدم خارج هذا النطاق. [تثبيت إطار](guides/integration.md) · [موائم الويب](devices/web-tv.md) · [إعداد بناء Wasm](../../apps/probe/web/engine/CMakeLists.txt)
- **حجم المجموعة.** يدعم كلّ مزوّد مجموعة نشطة واحدة بخلايا ثابتة الأبعاد وعمق لا يتجاوز مستويين. حدّها 256 عقدة منطقية، ويشمل العناصر غير المركّبة ونطاقاتها. اثنا عشر صفًّا من عشرين بطاقة تستهلك <bdi dir="ltr">`1 + 12 + 240 = 253`</bdi> عقدة. ومع صفّ ثالث عشر ممتلئ يصل المجموع إلى 274. حدِّد حجم المجموعة النشطة على الجهاز بصورة مستقلّة عن عدد العناوين في كتالوج الخادم. [حدود المجموعات](guides/collections.md)
- **الرجوع من شاشة التفاصيل.** تعمل `focusByKey` على Android وtvOS وفي مثال المتصفّح. يوفّر Android أيضًا الأمر المخصّص للاستعادة `restoreFocusByKey`. عندما يتولّى TalkBack التنقّل، يشترط هذا الأمر أن يكون الهدف مركّبًا وظاهرًا ومؤهّلًا سلفًا. يعيد موائما Apple والمتصفّح النتيجة `unavailable` لهذا الأمر، ولذلك يطلب Cinema التأشير بالمفتاح بالطريقة العادية حين يصبح الصفّ جاهزًا. [شيفرة الانتقال بين الشاشات](../../apps/probe/ott/src/Cinema.tsx) · [دليل الدمج](guides/integration.md)
- **الاختبار على الأجهزة.** اختُبر إطار سينما على Chromecast HD مع TalkBack. واجتاز الاختبار على Fire TV مع VoiceView، وعلى Apple TV HD مع VoiceOver، وعلى Samsung Tizen مع Voice Guide، وعلى LG webOS مع Audio Guidance. تبيّن أدلّة الأجهزة مسارات التنقّل التي اختُبرت والحالات التي تتطلّب إعادة الاختبار على Chromecast. [نتائج الاختبارات على الأجهزة](devices/README.md)

## مقارنة الإمكانات

يمثّل `react-native-tvos` بالإصدار 0.83.0-0 نظام التأشير المدمج الذي نقارن به. ويصف عمود BAM واجهة الإصدار 5.2.0 المستخدَم في شاشة المقارنة في Cinema. أمّا ملاحظته عن الصفوف الافتراضية فمصدرها ملف README الأحدث في الفرع `main` بتاريخ 23 أكتوبر 2025.

| ما الذي نقارنه؟ | إطار | React Native TV بنظام التأشير المدمج فيه | Norigin Spatial Navigation | مكتبة React TV Space Navigation من BAM بالإصدار 5.2.0 |
| --- | --- | --- | --- | --- |
| من يختار البطاقة التالية؟ | مضيف Android وسياسة C++، وUIKit للتنقّل المعتاد على tvOS، ونواة C++ المترجمة إلى Wasm مع DOM على الويب. | Android أو UIKit. يتيح `TVFocusGuideView` تحديد الوجهات وحصر التنقّل داخل منطقة، وتذكّر موضع الدخول باستخدام `autoFocus`. [أدلّة التأشير][rn-guides] | محرّك تنقّل مكاني بلغة JavaScript مع موائمات لقياس مواضع عناصر DOM وعناصر التلفاز الأصلية. ترتبط `useFocusable` بعنصر عرض موجود عبر مرجعه. [الدمج مع التلفاز الأصلي][n-native] | شجرة تنقّل مشتركة في React يديرها LRUD على التلفاز الأصلي والويب. [التصميم][b-design] |
| كيف أحدّد بطاقة بعينها؟ | `focusByKey(occurrenceKey)`، حتى لبطاقة تقع خارج الجزء المرئي من مجموعة مسجّلة. | `hasTVPreferredFocus` أو وجهات دليل التأشير أو `requestTVFocus()` على مرجع لعنصر مركّب. [تعريفات الواجهة الأصلية][rn-types] | `setFocus(focusKey)` مع إمكان تحديد المفتاح قبل تركيب العنصر وتذكّر آخر عنصر فرعي تلقّى التأشير. [خدمة التأشير][n-set] · [تعيين المفتاح مسبقًا][n-preset] · [تذكّر العنصر الفرعي][n-child] | `ref.focus()` لعقدة مركّبة أو `focus(index)` في القائمة الافتراضية. يتولّى التطبيق إيجاد الفهرس الحالي للبطاقة من معرّفها المحفوظ. [العقدة][b-node] · [القائمة][b-list] |
| كيف أعرف نتيجة طلب التأشير؟ | لكلّ طلب نتيجة تبيّن السبب والحالة النهائية، وهي `applied` أو `unavailable` أو `cancelled` أو `unsupported`. [أنواع نتائج الطلبات](../../packages/itar/src/api/types.ts) | ينقل `onFocus` و`onBlur` أحداث التأشير من عنصر العرض الأصلي. يتولّى التطبيق ربطها بطلبه. [الأحداث الأصلية][rn-events] | تعيد `setFocus` قيمة من النوع `Promise<void>`. تحدِّث التأشير المنطقي وتطلب من المنصّة نقل التأشير إلى عنصر العرض. لا يحمل الوعد نتيجة تؤكّد وصول تأشير المنصّة. [خدمة التأشير][n-set] · [إرسال الطلب إلى المنصّة][n-dispatch] | تعيد دالّتا التأشير `void`. وتتيح الشجرة رصد حالة التأشير المنطقي. [نوع مرجع العقدة][b-ref] · [القائمة][b-list] |
| هل يمكنني إلغاء ذلك الطلب؟ | نعم، باستدعاء `cancel()` على الطلب الذي أعادته الواجهة. | لا توفّر الواجهة مرجعًا لإلغاء كلّ طلب على حدة. | لا توفّر الواجهة مرجعًا لإلغاء كلّ طلب على حدة. | لا توفّر الواجهة مرجعًا لإلغاء كلّ طلب على حدة. |
| القوائم الافتراضية | قوائم وصفوف ثابتة الأبعاد، وإظهار البطاقات خارج الشاشة بمفاتيحها، وحدّ أقصى يبلغ 256 عقدة منطقية للمجموعة النشطة. | مكوّن `VirtualizedList` مهيّأ للتلفاز، مع أدلّة تأشير. [معالجة القوائم][rn-guides] | يتولّى التطبيق تحديد نافذة العناصر المعروضة وتسجيلها. [دليل الأداء][n-virtual] | قوائم وشبكات تدعم أبعادًا مختلفة للعناصر والتمرير بمحاذاة حافة البداية. ينبّه المطوّرون إلى مشكلة عند عرض مئات **الصفوف** افتراضيًا. [خيارات القائمة][b-options] · [الحدود المعروفة][b-limits] |
| قارئات الشاشة | تُرصد تغيّرات تأشير الإدخال والتأشير الخاصّ بإمكانية الوصول بصورة مستقلّة. يبيّن قسم حدود النسخة التجريبية ما اختُبر على كلّ جهاز. | واجهات إمكانية الوصول في المنصّة وأحداث التأشير الأصلية. [إمكانية الوصول على التلفاز][rn-a11y] | تسميات لإمكانية الوصول وإمكان تمرير دالّة للنطق بها. [دليل إمكانية الوصول][n-a11y] | دمج تجريبي مع TalkBack على Android. عندما يكون تأشير القارئ على بطاقة، تمنحها ضغطة Enter الأولى التأشير المنطقي في الشجرة، ثم تفعّلها الضغطة الثانية. [التحكّم مع قارئ الشاشة][b-reader] |
| المنصّات وما اختُبر عليها | اختُبر إطار سينما على خمسة أجهزة تلفاز وبثّ فعلية مع تفعيل قارئ الشاشة المدمج في كلّ منها، وعلى متصفّح Chromium للحاسوب. | تطبيقات Android TV وApple TV الأصلية. [المنصّات][rn-platforms] | يذكر المشروع استخدام المكتبة في تطبيقات منشورة على Tizen وwebOS، ويسرد Android TV وApple TV ضمن المنصّات المدعومة. [المنصّات][n-devices] | يسرد المشروع Android TV وtvOS ومتصفّحات التلفاز. [المنصّات][b-design] |
| التوزيع | تضمّ الحزمة التجريبية المحلية موائم التطبيقات الأصلية وموائم الويب. | حزمة `react-native-tvos` منشورة. | حزم منشورة للنواة وReact وReact Native TV. تعمل بلغة JavaScript من دون اشتراط Wasm، ولا تحدّد حدًّا أدنى لإصدار Chrome. [قائمة الأجهزة][n-devices] | حزمة `react-tv-space-navigation` منشورة. |

## من أين تبدأ؟

- **إطار** يناسب كتالوجًا على التلفاز الأصلي تتجدّد صفوفه أو يتغيّر ترتيبها، ويحتاج فيه التطبيق إلى العودة إلى بطاقة بعينها، ومعرفة هل وصل التأشير إليها، وإلغاء طلب تخلّى عنه المشاهد. طابِق أوّلًا حدود النسخة التجريبية أعلاه مع شاشات تطبيقك.
- **React Native TV بنظام التأشير المدمج فيه** يناسب الشاشات التي يضع فيها نظام التأشير في المنصّة وأدلّة التأشير المشاهدَ في الموضع الصحيح، ولا يحتاج فيها التطبيق إلى تتبّع كلّ طلب تأشير على حدة.
- **Norigin Spatial Navigation** تناسب تطبيق React على الويب موجّهًا إلى التلفزيونات الذكية، أو فريقًا يريد محرّك تأشير واحدًا بلغة JavaScript يذكر مطوّروه استخدامه في تطبيقات منشورة على Tizen وwebOS.
- **React TV Space Navigation من BAM** تناسب فريقًا يريد شجرة تنقّل واحدة يصفها بمكوّنات React ويشترك فيها التلفاز الأصلي والويب، من حزمة منشورة.

## تجربة إطار على شاشة واحدة

ابدأ بصفّ تعرف كيف يستجيب لجهاز التحكّم. تحتاج كلّ بطاقة إلى مفتاح ظهور ثابت يتضمّن هوية الصفّ، فيحصل العنوان الذي يظهر مرّتين على مفتاحين.

| ما تستخدمه الشاشة اليوم | ما يقابله في إطار |
| --- | --- |
| React Native TV بنظام التأشير المدمج فيه: مرجع و`requestTVFocus()`، مع `onFocus` لمعرفة ما حدث | `focusByKey(occurrenceKey)` والنتيجة `result` التي يحملها الطلب |
| Norigin: المفتاح `focusKey` والدالّة `setFocus(focusKey)` | المفتاح نفسه مفتاحَ ظهور، مع `focusByKey` |
| BAM: معرّف محفوظ يبحث التطبيق عن فهرسه الحالي ليستدعي `focus(index)` | `focusByKey(occurrenceKey)` من دون بحث عن الفهرس |

ضَع الشاشة داخل `FocusProvider`. لصفّ مركّب، استخدم `FocusScope` مع `layout="row"` وضع تسمية البطاقة وإجراء تفعيلها ومظهرها عند التأشير إليها على المكوّن الخارجي `Focusable`. وفي الصفوف الافتراضية ينشئ `FocusVirtualizedRails` عنصر التأشير لكلّ بطاقة. [دليل الدمج العملي](guides/integration.md) · [أمثلة Cinema](ott-app.md)

يظهر الفرق عند الرجوع من شاشة التفاصيل. مع Norigin يتحقّق التطبيق من تسجيل البطاقة التي فُتحت منها التفاصيل، ثم ينتظر وعدًا لا يحمل نتيجة تؤكّد وصول تأشير المنصّة:

<div dir="ltr">

```tsx
if (doesFocusableExist(openerKey)) {
  await setFocus(openerKey);
}
```

</div>

ومع إطار يبيّن الطلب نفسه ما حدث، ويمكن التراجع عنه:

<div dir="ltr">

```tsx
const {focusByKey} = useFocusCommands();
const pending = useRef<ReturnType<typeof focusByKey> | null>(null);

// Call this when the rail reports onReady after Back.
async function returnToOpener(openerKey: string) {
  const request = focusByKey(openerKey);
  pending.current = request;
  const outcome = await request.result;
  if (outcome.status === 'unavailable') {
    // The opener left the catalogue. Choose where the viewer goes.
    focusByKey(occurrenceKey('home', 'featured', 'featured-a'));
  }
}

// If the viewer leaves before the request settles:
pending.current?.cancel();
```

</div>

ثم اختبر الشاشة. افتح شاشة التفاصيل، وغيّر ترتيب الصفّ، ثم اضغط زرّ الرجوع. طابِق مفتاح الظهور المحفوظ مع البطاقة التي تتلقّى التأشير والعنوان الذي يفتحه زرّ الاختيار. كرّر التجربة بعد حذف البطاقة التي فُتحت منها التفاصيل، ثم غادر الشاشة أثناء انتظار ظهور بطاقة متأخّرة التحميل. في كلّ حالة تخبر النتيجةُ التطبيقَ بما فعلته المنصّة، فلا يضطرّ إلى استنتاجه من أحداث التأشير. وإذا كانت الشاشة منقولة من Norigin، فأداة التصحيح المرئية فيها تبيّن الوجهات التي كان التطبيق القديم يفحصها عند كلّ ضغطة سهم. [مثال القوائم](guides/collections.md) · [شيفرة الانتقال بين الشاشات](../../apps/probe/ott/src/Cinema.tsx) · [أداة تصحيح Norigin][n-debug]

## قياس سرعة الاستجابة

تعرض شاشة الاختبار الأصلية في Cinema ثمانية أهداف مركّبة في ثلاثة أوضاع. يستخدم الوضع المرجعي أدوات التحكّم التي توفّرها المنصّة. ويستخدم وضع إطار عناصر التأشير الخاصة بالمكتبة. أمّا في اختبار BAM فيظلّ تأشير المنصّة محصورًا في عنصر واحد، وترسم JavaScript علامة التأشير على الوجهة المنطقية. مع React 19 قد يتعذّر تحميل وحدة BAM الاختيارية ويظهر عنصر بديل. عندئذ استبعد تلك التجربة من النتائج. لا تتضمّن هذه الشاشة وضعًا لمكتبة Norigin. ويمكن إشغال خيط JavaScript لمدّة قصيرة لاختبار التنقّل بين العناصر المركّبة. أمّا إحضار خلية لم يركّبها React بعد فقد يحتاج إلى تشغيل JavaScript، وهذه الحالة خارج ما تختبره الشاشة. لم ينشر المشروع بعد قياسات على الأجهزة. ويتطلّب ترتيب الأنظمة بحسب زمن الاستجابة أو استهلاك الذاكرة قياسات قابلة للمقارنة على الأجهزة المستهدفة. [شاشة الاختبار](../../apps/probe/ValidationScreen.tsx) · [إعداد اختبار BAM](../../apps/probe/ComparisonLibrary.tsx)

رُوجعت مصادر المشاريع في 18 نوفمبر 2026. تشير الروابط إلى مراجعات الشيفرة التي بُنيت عليها المقارنة.

</div>

[n-devices]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/README.md#L12-L34
[n-native]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/guides/react-native-tv.md#L40-L51
[n-set]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/guides/programmatic-focus.md#L9-L29
[n-dispatch]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/packages/react-native-tvos/src/adapter.ts#L213-L234
[n-preset]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/api-reference/SpatialNavigation.md#L66
[n-child]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/guides/focus-hierarchy.md#L59-L81
[n-virtual]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/guides/performance.md#L150-L155
[n-a11y]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/guides/accessibility-labels.md#L5-L18
[n-debug]: https://github.com/NoriginMedia/Norigin-Spatial-Navigation/blob/fa336cd33017de32a62b58549e0e8d91ffe4cbcb/docs/guides/distance-calculation.md#L146-L158
[b-ref]: https://github.com/bamlab/react-tv-space-navigation/blob/a9cadbcebf5940864a81c094f427a18feef28ca5/packages/lib/src/spatial-navigation/types/SpatialNavigationNodeRef.ts#L1-L3
[b-design]: https://github.com/bamlab/react-tv-space-navigation/blob/a9cadbcebf5940864a81c094f427a18feef28ca5/README.md#L18-L34
[b-node]: https://github.com/bamlab/react-tv-space-navigation/blob/a9cadbcebf5940864a81c094f427a18feef28ca5/docs/api.md#L64-L69
[b-list]: https://github.com/bamlab/react-tv-space-navigation/blob/a9cadbcebf5940864a81c094f427a18feef28ca5/docs/api.md#L258-L263
[b-options]: https://github.com/bamlab/react-tv-space-navigation/blob/a9cadbcebf5940864a81c094f427a18feef28ca5/docs/api.md#L239-L252
[b-reader]: https://github.com/bamlab/react-tv-space-navigation/blob/a9cadbcebf5940864a81c094f427a18feef28ca5/docs/api.md#L480-L489
[b-limits]: https://github.com/bamlab/react-tv-space-navigation/blob/7e31e426b09d7c23d458adb963ef4bc9fe8eff60/README.md#L83-L87
[rn-guides]: https://github.com/react-native-tvos/react-native-tvos/blob/e7022f2672cb2fdbf7b2e7ec86ba130f2d229fd9/README.md#L288-L309
[rn-types]: https://github.com/react-native-tvos/react-native-tvos/blob/e7022f2672cb2fdbf7b2e7ec86ba130f2d229fd9/packages/react-native/types/public/ReactNativeTVTypes.d.ts#L38-L92
[rn-events]: https://github.com/react-native-tvos/react-native-tvos/blob/e7022f2672cb2fdbf7b2e7ec86ba130f2d229fd9/README.md#L187-L199
[rn-a11y]: https://github.com/react-native-tvos/react-native-tvos/blob/e7022f2672cb2fdbf7b2e7ec86ba130f2d229fd9/README.md#L286
[rn-platforms]: https://github.com/react-native-tvos/react-native-tvos/blob/e7022f2672cb2fdbf7b2e7ec86ba130f2d229fd9/README.md
