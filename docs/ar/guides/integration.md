<div dir="rtl" lang="ar">

# إضافة إطار إلى تطبيق React Native للتلفاز

[فهرس الأدلة العربية](../README.md) · [English](../../guides/integration.md)


توفّر نقطة الدخول `@bougarnem/itar/react` مكوّنات لتعريف نطاقات التأشير والأزرار والقوائم ذات العناصر ثابتة الأبعاد، وأوامر لنقل التأشير واستعادته. لتثبيت النسخة التجريبية، نفّذ `npm install @bougarnem/itar@beta`. يمكنك تعديل تطبيق التلفاز المرفق، أو تحزيم المكتبة محليًا وتجربتها في تطبيقك. يستخدم المثال React 19.2.0 ونسخة React Native الخاصة بالتلفاز تحت الاسم `"react-native": "npm:react-native-tvos@0.83.0-0"`. تعتمد المكوّنات الأصلية على Fabric، وتستورد تطبيقات الويب الموائم من `@bougarnem/itar/web`. [تشغيل إطار سينما](../ott-app.md) · [إعداد المتصفح](../devices/web-tv.md)

## تثبيت الحزمة من نسخة محلية

استخدم Node 22.23.4 وnpm 10.9.9. نفّذ الأوامر التالية من جذر مستودع إطار. يثبّت الأمر الأول الإصدارات المسجّلة في ملف القفل. يبني أمر التحزيم ملفات JavaScript وتعريفات TypeScript، ويضمّ إليها شيفرة C++ وملفات الترويسة والرخصة التي يحتاجها تطبيق مستقل.

لتحزيم الإصدار من المصدر، ثبّت [Emscripten 6.0.13 وCMake](../devices/web-tv.md) لبناء محرّك الويب. يكفي تثبيت الأرشيف الناتج في التطبيق الذي سيستخدمه.

<div dir="ltr">

```sh
npm ci --ignore-scripts --no-audit
mkdir -p build/packages
npm pack --workspace @bougarnem/itar --pack-destination build/packages
```

</div>

انتقل إلى تطبيقك وثبّت الملف الناتج، مع استبدال المسار بموقع نسختك. أعد بناء التطبيق الأصلي لتسجيل واجهات Fabric وربط مكتبة C++. أما التطبيق المرفق فيرتبط بالحزمة المحلية تلقائيًا بعد `npm ci`.

<div dir="ltr">

```sh
npm install /absolute/path/to/itar/build/packages/bougarnem-itar-0.1.0-beta.tgz
```

</div>

- **Android TV.** استخدم الربط التلقائي للمكتبات الأصلية في قالب التلفاز. تحدّد المكتبة Android SDK 36 وحدًا أدنى هو API 24 وNDK 27.1.12297006 وCMake 3.22.1. استُخدم JDK 17 لبناء تطبيق يستهلك الحزمة. [إعدادات المكتبة](../../../packages/itar/android/build.gradle)
- **tvOS.** أضف السطر التالي إلى هدف التلفاز في `ios/Podfile`. يسمح ملف podspec لـ React Native بربط `ItarEngineNative` تلقائيًا، ويحدّد السطر موقع نواة C++ في الحزمة نفسها. شغّل `bundle exec pod install` من `ios/` وابنِ مخطّط التلفاز من مساحة عمل Xcode الناتجة. الحدّ الأدنى المعلَن هو tvOS 15.1. عند استخدام SDK 27 مع Apple Clang 21، يضبط المثال أيضًا دورة حياة المشهد واعتمادية fmt في قالب التلفاز. [دليل Apple TV](../devices/apple-tv.md) · [التكامل الأصلي](../../../packages/itar/apple/README.ar.md)

<div dir="ltr">

```ruby
pod 'ItarEngineCore', :path => '../node_modules/@bougarnem/itar'
```

</div>

للتحقّق من الأرشيف، نفّذ `node scripts/check-package.cjs build/package-check` من جذر المستودع. يثبّت البرنامج الأرشيف في مجلد مستقل عن مساحة عمل npm، ويتحقّق من نقاط الدخول، ثم يترجم مثال C++ صغيرًا يستخدم واجهة C الخاصة بـ Apple. يتطلّب اختبار التنقّل الفعلي تشغيل تطبيق التلفاز. [برنامج التحقّق](../../../scripts/check-package.cjs) · [اختبار الأجهزة](../devices/README.md)

## استخدام إطار في تطبيق ويب للتلفاز

لتطبيقات الويب، ومنها تطبيقات Samsung Tizen وLG webOS، استورد المكوّنات من `@bougarnem/itar/web`. ثبّت React وReact DOM بالإصدار 19.2.0 مع `react-native-web@0.21.4`، واستورد `@bougarnem/itar/web.css` وانتظر اكتمال `initializeFocusEngine()` قبل عرض أوّل `FocusProvider`. يتضمّن موائم الويب المحرّك بصيغة Wasm ويمكن تحميله من ملفات التطبيق على التلفاز.

<div dir="ltr">

```tsx
import {createRoot} from 'react-dom/client';
import {FocusProvider, FocusScope, Focusable, initializeFocusEngine} from '@bougarnem/itar/web';
import '@bougarnem/itar/web.css';

initializeFocusEngine().then(() => {
  createRoot(document.getElementById('root')!).render(
    <FocusProvider>
      <FocusScope id="actions" layout="row" style={{flexDirection: 'row'}}>
        <Focusable occurrenceKey="play" accessibilityLabel="تشغيل" style={{width: 160, height: 80}} />
        <Focusable occurrenceKey="save" accessibilityLabel="حفظ" style={{width: 160, height: 80}} />
      </FocusScope>
    </FocusProvider>,
  );
});
```

</div>

## إنشاء شاشة بزرّين

ضع هذا المكوّن في ملف `App.tsx` لتطبيق التلفاز. انتقل يمينًا ويسارًا ثم اضغط زر الاختيار لتفعيل أحد العنوانين. تصف الخاصية `layout="row"` ترتيب التنقّل في النطاق، وتحدّد أنماط React Native توزيع الأزرار على الشاشة. يتغيّر مظهر الزر عند تلقّيه التأشير الفعلي، ويتغيّر النص أسفل الصف عند تفعيله.

<div dir="ltr">

```tsx
import React, {useState} from 'react';
import {Text} from 'react-native';
import {Focusable, FocusProvider, FocusScope, occurrenceKey} from '@bougarnem/itar/react';

const titles = [
  {entry: 'featured-a', movie: 'film-7', title: 'Paper Moon'},
  {entry: 'featured-b', movie: 'film-9', title: 'Night Train'},
];

export default function App() {
  const [selected, setSelected] = useState('Choose a title');

  return (
    <FocusProvider style={{flex: 1, backgroundColor: '#fff'}}>
      <FocusScope id="featured" layout="row" style={{flexDirection: 'row'}}>
        {titles.map((item, order) => (
          <Focusable
            key={item.entry}
            occurrenceKey={occurrenceKey('home', 'featured', item.entry)}
            contentId={item.movie}
            accessibilityLabel={item.title}
            order={order}
            style={{width: 220, height: 88}}
            focusStyle={{accentColor: '#006699'}}
            onPress={() => setSelected(item.title)}
          />
        ))}
      </FocusScope>
      <Text style={{color: '#111'}}>{selected}</Text>
    </FocusProvider>
  );
}
```

</div>

أعطِ كل موضع يظهر فيه عنوان مفتاحًا ثابتًا وفريدًا ضمن `FocusProvider`. إذا ظهر فيلم *Paper Moon* في صف العروض المميّزة وصف متابعة المشاهدة، فقد تحمل البطاقتان `contentId="film-7"` نفسه. لكن لكل بطاقة مفتاح ظهور خاص بها، حتى لو ظهر الفيلم مرتين في الصف نفسه. احتفظ بالمفتاح عند نقل البطاقة داخل البيانات. الاعتماد على فهرس المصفوفة قد يعيد التأشير إلى فيلم آخر بعد إعادة الترتيب.

يدير كل `FocusProvider` سطحًا أصليًا واحدًا. يكفي أن يكون `id` الخاص بالنطاق فريدًا داخل نطاقه الأب. تتيح `boundary="parent"` مغادرة النطاق المتداخل عند حافته. القيمة الافتراضية `stop` توقف الحركة عند الحافة، و`wrap` تسمح بالانتقال إلى الطرف الآخر. استخدم `trap` لحصر التنقّل الاتجاهي الذي يديره إطار داخل نطاق. يتولّى UIKit جانبًا كبيرًا من تنقّل العناصر المعروضة والإيماءات. اختبر الحواف واتجاه الحركة على كل جهاز مستهدف. [دور كل طبقة](architecture.md)

## مراقبة التأشير أو طلب نقله

استدعِ الخطّافات داخل مكوّن تابع لـ `FocusProvider`. استخدم `focusStyle` لرسم التمييز المعتاد كي يستجيب المضيف حتى عندما ينشغل خيط JavaScript. اشترك في تغيّرات التأشير عندما تحتاج واجهة تطبيقك إلى معرفة البطاقة المحدّدة فعليًا.

| الواجهة | متى تستخدمها؟ |
| --- | --- |
| `useFocusReady()` | لمعرفة ما إذا كان السطح الأصلي متّصلًا ونشطًا وقادرًا على تلقّي أمر. قد تكون القائمة ما زالت تسجّل بياناتها. |
| `useFocusState('input')` | لقراءة آخر ما رصده المضيف عن تأشير الإدخال. الحالات هي `managed` و`unmanaged` و`absent` و`unknown`. تحمل الحالة الأولى وحدها مفتاح ظهور العنصر. |
| `useIsFocused(key, channel?)` | لتحديث جزء صغير من الواجهة يخصّ موضعًا واحدًا. القناة الافتراضية هي تأشير الإدخال. |
| `useFocusState('accessibility')` | لمراقبة تأشير إمكانية الوصول بصورة مستقلّة، في حدود ما يستطيع المضيف رصده. |
| `useScreenReaderEnabled()` | لتكييف خصائص مثل التشغيل التلقائي مع قارئ الشاشة. تكون القيمة `null` حتى تُعرف حالة القارئ. |
| `useFocusCommands()` | لطلب عنصر بمفتاحه، أو استعادة نطاق، أو فتح نافذة الاختبار الأصلية المضمّنة وإغلاقها. |

أضف الزر التالي بعد عنوانَي الفيلم داخل نطاق الصف نفسه. يطلب الزر نقل التأشير إلى البطاقة الأولى ويعرض نتيجة الطلب. يمكن للمستدعي استخدام `cancel()` إذا غادر الشاشة قبل اكتمال العملية. إذا كان المضيف قد تلقّى الأمر الأصلي بالفعل، فقد يرصد لاحقًا تغيّرًا حقيقيًا في التأشير.

<div dir="ltr">

```tsx
import React, {useState} from 'react';
import {Text} from 'react-native';
import {Focusable, occurrenceKey, useFocusCommands, useFocusReady} from '@bougarnem/itar/react';

export function FocusFirstTitle() {
  const {focusByKey} = useFocusCommands();
  const ready = useFocusReady();
  const [status, setStatus] = useState('');

  async function move() {
    const request = focusByKey(occurrenceKey('home', 'featured', 'featured-a'));
    const outcome = await request.result;
    setStatus(outcome.status + ' (' + outcome.reason + ')');
  }

  return (
    <>
      <Focusable
        occurrenceKey={occurrenceKey('home', 'featured', 'shortcut')}
        accessibilityLabel="Focus first title"
        enabled={ready}
        order={2}
        style={{width: 200, height: 88}}
        onPress={move}
      />
      <Text>{status}</Text>
    </>
  );
}
```

</div>

عند تأكيد وصول التأشير، تكون النتيجة `applied`. الحالات الأخرى هي `cancelled` عند إلغاء الطلب، و`unavailable` إذا تعذّر إتمامه، و`unsupported` عندما لا تدعم بيئة التشغيل أو قناة الاتصال العملية. يحمل `outcome.reason` تفاصيل السبب. نقل التأشير وتفعيل العنصر عمليتان مستقلّتان. يتلقّى `onPress` مفتاح الظهور ومصدر التفعيل ومعرّف المحتوى الاختياري. يمكن لقارئ الشاشة مثلًا تفعيل زر يختلف عن الزر الذي يستقبل إدخال جهاز التحكّم.

على Android، يمكن إظهار العنصر المركَّب بالتمرير قبل نقل التأشير إليه بأسهم جهاز التحكّم. ضع مكوّن التمرير الأصلي داخل نطاق `FocusScope` الذي يديره، واستخدم `layout="row"` للتمرير الأفقي أو `layout="column"` للتمرير الرأسي. عند تداخل مساحات التمرير، يبدأ المحوّل من أقرب مكوّن تمرير يشترك فيه العنصر الحالي والوجهة، ثم يُظهر الوجهة بالترتيب من الخارج إلى الداخل. يجب أن تتّسع كل مساحة عرض معنيّة للوجهة كاملةً. يُستخدم هذا المسار عندما يتولّى التطبيق التعامل مع أسهم جهاز التحكّم. للعناصر التي لم تُركَّب بعد، راجع [دليل المجموعات](collections.md).

## الانتقال بين الشاشات وإمكانية الوصول

- **العودة إلى قائمة.** استخدم `restoreOnEntry` لتذكّر الوجهة عند دخول النطاق بمفتاح اتجاه. للاستعادة الصريحة، فعّل النطاق أولًا وانتظر اعتماد التغيير، ثم اطلب `restoreScope(['home', 'menu'])` باستخدام معرّفات النطاقات الفعلية بالترتيب. يبدأ المحرّك بآخر وجهة صالحة في السجلّ، ثم يطبّق سياسة الدخول المعلنة، ومنها `preferredKey`. إزالة النطاق من شجرة العرض تفقده سجلّه.
- **العودة من التفاصيل.** احفظ `activation.occurrenceKey` عند فتح التفاصيل. بعد تفعيل الشاشة السابقة ووصول إشارة `onReady` من الصف، يستطيع موائم Android استعادة البطاقة عبر `restoreFocusByKey(savedKey)`. حين يتولّى القارئ التنقّل، يجب أن تكون البطاقة معروضة ومرئية ومؤهّلة أصلًا. يستعيد الأمر تأشير الإدخال فقط. يعيد موائم Apple ومثال المتصفح حاليًا `unavailable` لهذا الأمر تحديدًا.
- **استبدال شاشة عليها التأشير.** طبّق `entryReady={false}` في نطاق الوجهة قبل إزالة المصدر. يؤخّر هذا الدخول التلقائي حتى يجهز المحتوى. اطلب التأشير صراحةً عندما تجهز الوجهة، ثم أعد فتح الدخول بعد انتهاء الطلب، حتى في حال الفشل أو الإلغاء. احتفظ بالنطاق القديم وموضع التمرير إذا احتجت إلى سجلّ الرجوع.
- **محتوى البطاقات.** عيّن حجمًا واضحًا وتسمية لقارئ الشاشة على `Focusable` الخارجي. اجعل الصور والنصوص داخله للعرض فقط. يتولّى المضيف الخارجي الدلالات والتفعيل وتمييز التأشير. ضع أدوات التحكّم المستقلّة بجوار البطاقة.
- **المفاتيح وأشرطة الضبط.** للمفتاح على Android أو في المتصفح، استخدم `accessibilityRole="switch"` و`accessibilityState={{checked: value}}`. لا يوفّر موائم Apple حاليًا دلالة حالة المفتاح ضمن هذه الواجهة. للعنصر القابل للضبط، استخدم `onAdjust(delta)` دون تحديد دور صريح. يطبّق التطبيق الحدّين الأدنى والأعلى ويعدّل القيمة عند تلقّي `-1` أو `1`. أبقِ `onPress` لزر الاختيار.

لمثال يضمّ عدة صفوف ويتيح التمرير، تابع إلى [دليل القوائم والصفوف](collections.md). وتجد مواصفات المكوّنات والأحداث في [مرجع الحزمة](../../../packages/itar/README.ar.md).

## تجربة السلوك في إطار سينما

في نسخة تطوير أصلية، افتح **Settings** ثم **Open original Itar probes**. تعرض كل شاشة تجربة قصيرة يمكن تكرارها بجهاز التحكّم.

| اسم الشاشة في التطبيق | تجربة مقترحة |
| --- | --- |
| **React API preview** | انتقل إلى عنوان في الصف B واضغط زر الاختيار. لاحظ مفتاح الظهور المسجّل، وافتح التفاصيل ثم عُد، وقارن وجهة التأشير بنتيجة الأمر. |
| **Virtualized list preview** | اختر **Focus start** ثم **Reveal distant item**. كرّر باستخدام **Cancel delayed reveal**. غيّر خيار دخول الصف في **Nested rails** وقارن العمود الذي يصل إليه التأشير عند تغيير الصف. |
| **Release validation** | اختر تنفيذ النظام أو المكتبة المقارنة أو إطار للتنقّل بين الأهداف الثمانية نفسها. جدوِل انشغالًا مؤقّتًا لخيط JavaScript وتنقّل بجهاز التحكّم. يتطلّب قياس الاستجابة المرئية أثناء ذلك رصدًا من المضيف الأصلي. |

يعيدك **Return to Itar Cinema** إلى تطبيق المثال. عند الإبلاغ عن اختلاف على جهاز فعلي، اذكر الطراز وإصدار النظام ومراجعة التطبيق ووسيلة الإدخال وحالة القارئ وترتيب الضغطات. [شاشات التجربة](../../../apps/probe/ProbeApp.tsx) · [دليل الأجهزة](../devices/README.md)

</div>
