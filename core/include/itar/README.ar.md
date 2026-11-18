<div lang="ar" dir="rtl">

# ملفات ترويسة النواة

[English](README.md)

عند ربط تطبيقك بالهدف `itar::core`، ضمِّن ملفات الترويسة بالصيغة `<itar/name.hpp>`. ابدأ بالملفين [state.hpp](state.hpp) و[identity.hpp](identity.hpp) لفهم سطح التركيز ومفاتيح ظهور العناصر ومعرّفات تسجيلها. يعرّف [navigation.hpp](navigation.hpp) واجهة اختيار الوجهة، ويعرض [transaction.hpp](transaction.hpp) دورة حياة الطلب والعمليات التي يطلبها من المضيف. ويضيف [collection.hpp](collection.hpp) عناصر القوائم ثابتة الأبعاد وسياسة الدخول إلى صفوفها. يجمع [شرح البنية](../../../docs/ar/guides/architecture.md) هذه الأجزاء في مثال واحد.

تخصّ الترويسات في [probe/](probe/) هدف التجارب المستقل `itar::probe`.

</div>
