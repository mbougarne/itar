<div lang="ar" dir="rtl">

# نواة إطار بلغة `C++20`

[English](README.md)

توفّر المكتبة الساكنة `itar_core` هدف البناء `itar::core` في CMake. تتولّى النواة إدارة حالة سطح التركيز، وهويات العناصر، وقياساتها المعتمدة، واختيار وجهة التنقّل، وتتبع طلبات التركيز، وتسجيل عناصر القوائم. أمّا المضيف فيزوّدها بأحداث الإدخال والقياسات وبالعنصر الذي تلقّى التركيز فعلاً. يمكنك بناء النواة واختبارها على حاسوبك دون React أو JavaScript أو حزمة تطوير تلفاز.

## البناء والاختبار

تحتاج إلى CMake بإصدار 3.20 أو أحدث، ومُصرّف يدعم `C++20`. نفّذ الأوامر من جذر المستودع.

<div dir="ltr">

```sh
cmake -S core -B build/core -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON
cmake --build build/core --parallel 2
ctest --test-dir build/core --output-on-failure --no-tests=error --timeout 60
```

</div>

لبناء المحرّك وحده استخدم `cmake --build build/core --target itar_core`. يوضّح [مثال التطبيق المستقل](../docs/ar/guides/architecture.md) كيف تربط النواة ببرنامجك عبر CMake. خصّص مجلد بناء لكل إعداد.

تشمل اختبارات CTest التسجيل وإعادة ربط عناصر الواجهة، والتحديثات الذرية، والقياسات، والتنقّل، وطلبات التركيز وإعادة تشغيل تسلسل أحداثها، والقوائم وواجهات الاتصال بالمنصات. لعرض الاختبارات ثم تشغيل ما يخص القوائم منها:

<div dir="ltr">

```sh
ctest --test-dir build/core -N
ctest --test-dir build/core -R collection --output-on-failure
```

</div>

لاستخدام أدوات كشف أخطاء الذاكرة والسلوك غير المحدد مع Clang، أنشئ مجلد بناء جديداً بإعداد `Debug` وأضف `-fsanitize=address,undefined -fno-omit-frame-pointer` إلى `CMAKE_CXX_FLAGS`. تجد الأعلام الكاملة في [إعدادات التكامل المستمر](../.github/workflows/ci.yml). يتيح الخيار `-DITAR_BUILD_BENCHMARKS=ON` بناء أداة القياس `itar_core_costs`. تقيس الأداة كلفة عمل النواة على الجهاز الذي يشغّلها. وقياس الزمن من ضغطة جهاز التحكّم إلى ظهور إطار التركيز يتطلب تجربة على تلفاز.

## قراءة الشيفرة

يشرح [دليل البنية](../docs/ar/guides/architecture.md) هوية كل ظهور للعنصر، وأجيال التسجيل، والقياسات المعتمدة، واختيار الوجهة، وكيف يؤكد المضيف انتقال التركيز. ويشرح [دليل القوائم](../docs/ar/guides/collections.md) دخول الصف واستحضار العنصر الذي يقع خارج الشاشة. تجد الأنواع في [ملفات الترويسة](include/itar/README.ar.md) وأمثلة السلوك المتوقع في [الاختبارات](tests/). وللتجارب المحدودة هدف بناء منفصل هو [itar::probe](include/itar/probe/).

</div>
