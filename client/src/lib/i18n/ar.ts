import type { Dictionary } from './translate';

/**
 * Arabic (Modern Standard).
 *
 * Typed as `Dictionary`, which requires every key the English dictionary
 * declares — so deleting or renaming an English string breaks the build here
 * until this file catches up. That is the whole point: a half-translated
 * dictionary is the normal failure mode of i18n, and it is invisible until a
 * user reports it.
 *
 * ## Plurals
 *
 * Arabic has six plural categories where English has two, and `Intl.PluralRules`
 * picks between them. A family may therefore carry `_zero`, `_two`, `_few` and
 * `_many` in addition to the `_one` / `_other` that English requires; anything
 * omitted falls back to `_other`. "3 days" and "11 days" genuinely are different
 * words, which is why this is not a `count === 1` check.
 */
export const ar: Dictionary = {
  /* -------------------------------------------------------------- *
   * Validation (mirrors the shared schema keys)
   * -------------------------------------------------------------- */
  'validation.required': 'يجب إدخال {field}',
  'validation.tooLong_one': 'يجب ألا يتجاوز طول {field} حرفًا واحدًا',
  'validation.tooLong_two': 'يجب ألا يتجاوز طول {field} حرفين',
  'validation.tooLong_few': 'يجب ألا يتجاوز طول {field} {count} أحرف',
  'validation.tooLong_many': 'يجب ألا يتجاوز طول {field} {count} حرفًا',
  'validation.tooLong': 'يجب ألا يتجاوز طول {field} {count} حرف',
  'validation.maxLength_one': 'يجب ألا يتجاوز الطول حرفًا واحدًا',
  'validation.maxLength_two': 'يجب ألا يتجاوز الطول حرفين',
  'validation.maxLength_few': 'يجب ألا يتجاوز الطول {count} أحرف',
  'validation.maxLength_many': 'يجب ألا يتجاوز الطول {count} حرفًا',
  'validation.maxLength': 'يجب ألا يتجاوز الطول {count} حرف',
  'validation.minLength_one': 'يجب ألا يقل طول {field} عن حرف واحد',
  'validation.minLength_two': 'يجب ألا يقل طول {field} عن حرفين',
  'validation.minLength_few': 'يجب ألا يقل طول {field} عن {count} أحرف',
  'validation.minLength_many': 'يجب ألا يقل طول {field} عن {count} حرفًا',
  'validation.minLength': 'يجب ألا يقل طول {field} عن {count} حرف',
  'validation.email': 'أدخل بريدًا إلكترونيًا صحيحًا',
  'validation.emailRequired': 'البريد الإلكتروني مطلوب',
  'validation.phone': 'أدخل رقم هاتف صحيحًا',
  'validation.phoneTooLong': 'رقم الهاتف طويل جدًا',
  'validation.date': 'أدخل تاريخًا صحيحًا',
  'validation.dateRequired': 'التاريخ مطلوب',
  'validation.number': 'أدخل رقمًا',
  'validation.negative': 'لا يمكن أن تكون القيمة سالبة',
  'validation.tooLarge': 'القيمة كبيرة بشكل غير واقعي',
  'validation.passwordRequired': 'كلمة المرور مطلوبة',
  'validation.passwordMin_one': 'يجب ألا تقل كلمة المرور عن حرف واحد',
  'validation.passwordMin_two': 'يجب ألا تقل كلمة المرور عن حرفين',
  'validation.passwordMin_few': 'يجب ألا تقل كلمة المرور عن {count} أحرف',
  'validation.passwordMin_many': 'يجب ألا تقل كلمة المرور عن {count} حرفًا',
  'validation.passwordMin': 'يجب ألا تقل كلمة المرور عن {count} حرف',
  'validation.passwordMax_one': 'يجب ألا تتجاوز كلمة المرور حرفًا واحدًا',
  'validation.passwordMax_two': 'يجب ألا تتجاوز كلمة المرور حرفين',
  'validation.passwordMax_few': 'يجب ألا تتجاوز كلمة المرور {count} أحرف',
  'validation.passwordMax_many': 'يجب ألا تتجاوز كلمة المرور {count} حرفًا',
  'validation.passwordMax': 'يجب ألا تتجاوز كلمة المرور {count} حرف',
  'validation.passwordLetter': 'يجب أن تحتوي كلمة المرور على حرف واحد على الأقل',
  'validation.passwordNumber': 'يجب أن تحتوي كلمة المرور على رقم واحد على الأقل',
  'validation.passwordConfirm': 'يرجى تأكيد كلمة المرور',
  'validation.passwordMismatch': 'كلمتا المرور غير متطابقتين',
  'validation.currentPasswordRequired': 'كلمة المرور الحالية مطلوبة',
  'validation.tagsMax_one': 'حتى وسم واحد',
  'validation.tagsMax_two': 'حتى وسمين',
  'validation.tagsMax_few': 'حتى {count} وسوم',
  'validation.tagsMax_many': 'حتى {count} وسمًا',
  'validation.tagsMax': 'حتى {count} وسم',
  'validation.noChanges': 'لم يتم إرسال أي تغييرات',
  'validation.requiredShort': 'مطلوب',

  'field.name': 'الاسم',
  'field.companyName': 'اسم الشركة',
  'field.customerName': 'اسم العميل',
  'field.requestedService': 'الخدمة المطلوبة',
  'field.title': 'العنوان',
  'field.tag': 'الوسم',
  'field.note': 'الملاحظة',
  'field.value': 'القيمة',

  /* -------------------------------------------------------------- *
   * Common
   * -------------------------------------------------------------- */
  'common.cancel': 'إلغاء',
  'common.saving': 'جارٍ الحفظ…',
  'common.tryAgain': 'إعادة المحاولة',
  'common.loading': 'جارٍ التحميل…',
  'common.clearAll': 'مسح الكل',
  'common.clearFilters': 'مسح عوامل التصفية',
  'common.clearSelection': 'مسح التحديد',
  'common.noMatches': 'لا توجد نتائج',
  'common.searchIn': 'ابحث في {label}…',
  'common.clearSearch': 'مسح البحث',
  'common.unassigned': 'غير مُسنَد',
  'common.deactivatedSuffix': ' (معطّل)',
  'common.you': '(أنت)',
  'common.dash': '—',
  'common.days_zero': '{count} يوم',
  'common.days_one': 'يوم واحد',
  'common.days_two': 'يومان',
  'common.days_few': '{count} أيام',
  'common.days_many': '{count} يومًا',
  'common.days_other': '{count} يوم',
  'common.daysShort': '{count} ي',
  'common.percent': '{value}٪',
  'common.somethingWentWrong': 'حدث خطأ ما. تحقق من اتصالك ثم أعد المحاولة.',
  'common.couldNotLoad': 'تعذّر تحميل هذا',
  'common.soon': 'قريبًا',
  'common.comingLater': 'قادم في إصدار لاحق',

  /* -------------------------------------------------------------- *
   * Application chrome
   * -------------------------------------------------------------- */
  'nav.main': 'التنقل الرئيسي',
  'nav.openNavigation': 'فتح قائمة التنقل',
  'nav.navigation': 'التنقل',
  'nav.leads': 'العملاء المحتملون',
  'nav.pipeline': 'مسار المبيعات',
  'nav.dashboard': 'لوحة التحكم',
  'nav.followUps': 'المتابعات',
  'nav.team': 'الفريق',

  'menu.appearance': 'المظهر',
  'menu.themeLight': 'فاتح',
  'menu.themeDark': 'داكن',
  'menu.themeSystem': 'حسب النظام',
  'menu.language': 'اللغة',
  'menu.signOut': 'تسجيل الخروج',
  'menu.signedOut': 'تم تسجيل الخروج',
  'menu.accountMenu': 'قائمة الحساب',

  'language.en': 'English',
  'language.ar': 'العربية',
  'language.switch': 'تغيير اللغة',
  'language.changed': 'تم تغيير اللغة إلى العربية',

  'demo.title': 'هذه مساحة عمل تجريبية خاصة بك.',
  'demo.bodyWithExpiry': 'عدّل ما تشاء — لا يراها أحد غيرك، وستُحذف خلال {remaining}.',
  'demo.body': 'عدّل ما تشاء — لا يراها أحد غيرك.',

  /* -------------------------------------------------------------- *
   * Errors
   * -------------------------------------------------------------- */
  'error.title': 'حدث خلل',
  'error.body': 'أوقف خطأ غير متوقع عرض الصفحة. عادةً ما يحل تحديث الصفحة المشكلة.',
  'error.reload': 'إعادة تحميل الصفحة',
  'error.notFoundTitle': 'الصفحة غير موجودة',
  'error.notFoundEmbedded': 'هذه الصفحة غير متاحة بعد. ستصل إدارة المتابعات في إصدار لاحق.',
  'error.notFoundStandalone': 'هذا الرابط لا يؤدي إلى أي صفحة. ربما نُقل أو حُذف السجل.',
  'error.backToLeads': 'العودة إلى العملاء المحتملين',
  'error.goToLeads': 'الانتقال إلى العملاء المحتملين',

  'apiError.UNAUTHORIZED': 'يلزم تسجيل الدخول للمتابعة',
  'apiError.INVALID_CREDENTIALS': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  'apiError.SESSION_EXPIRED': 'انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.',
  'apiError.ACCOUNT_INACTIVE': 'لم يعد حسابك نشطًا',
  'apiError.CURRENT_PASSWORD_INCORRECT': 'كلمة المرور الحالية غير صحيحة',
  'apiError.EMAIL_TAKEN': 'يوجد حساب مسجَّل بهذا البريد الإلكتروني',
  'apiError.FORBIDDEN': 'ليست لديك صلاحية القيام بذلك',
  'apiError.NOT_FOUND': 'لم يعد هذا السجل موجودًا',
  'apiError.VALIDATION_ERROR': 'بعض الحقول بحاجة إلى مراجعة',
  'apiError.RATE_LIMITED': 'عدد كبير من الطلبات. يرجى المحاولة بعد قليل.',
  'apiError.DATABASE_UNAVAILABLE': 'الخدمة غير متاحة مؤقتًا. يرجى إعادة المحاولة.',
  'apiError.INTERNAL_ERROR': 'حدث خطأ لدينا. يرجى إعادة المحاولة.',

  /* -------------------------------------------------------------- *
   * Authentication
   * -------------------------------------------------------------- */
  'auth.loginTitle': 'أهلًا بعودتك',
  'auth.loginSubtitle': 'سجّل الدخول لتكمل من حيث توقفت.',
  'auth.noAccount': 'ليس لديك حساب؟',
  'auth.createOne': 'أنشئ حسابًا',
  'auth.haveAccount': 'لديك حساب بالفعل؟',
  'auth.signIn': 'تسجيل الدخول',
  'auth.checkingSession': 'جارٍ التحقق من جلستك…',
  'auth.workEmail': 'بريد العمل',
  'auth.emailPlaceholder': 'you@company.com',
  'auth.password': 'كلمة المرور',
  'auth.passwordPlaceholder': 'أدخل كلمة المرور',
  'auth.showPassword': 'إظهار كلمة المرور',
  'auth.hidePassword': 'إخفاء كلمة المرور',

  'auth.signupTitle': 'أنشئ مساحة عملك',
  'auth.signupSubtitle': 'جهّز مسار مبيعات فريقك في أقل من دقيقة. دون الحاجة إلى بطاقة.',
  'auth.yourName': 'اسمك',
  'auth.namePlaceholder': 'ليلى حدّاد',
  'auth.companyName': 'اسم الشركة',
  'auth.companyPlaceholder': 'مجموعة ميريديان العقارية',
  'auth.companyHint': 'سيصبح هذا اسم مساحة عملك، ويمكنك دعوة فريقك بعد الدخول.',
  'auth.createPassword': 'أنشئ كلمة مرور',
  'auth.passwordHint_one': 'حرف واحد على الأقل، مع حرف ورقم.',
  'auth.passwordHint_two': 'حرفان على الأقل، مع حرف ورقم.',
  'auth.passwordHint_few': '{count} أحرف على الأقل، مع حرف ورقم.',
  'auth.passwordHint_many': '{count} حرفًا على الأقل، مع حرف ورقم.',
  'auth.passwordHint': '{count} حرف على الأقل، مع حرف ورقم.',
  'auth.confirmPassword': 'تأكيد كلمة المرور',
  'auth.confirmPlaceholder': 'أعد إدخال كلمة المرور',
  'auth.createWorkspace': 'إنشاء مساحة العمل',

  'auth.demoTitle': 'تريد إلقاء نظرة فقط؟',
  'auth.demoBody':
    'يفتح مساحة عمل خاصة بك تضم {count} عميلًا محتملًا وسجل نشاط كاملًا. غيّر ما تشاء — لا يراه أحد غيرك، وسيُحذف بعد يوم.',
  'auth.demoStart': 'ابدأ العرض التجريبي',
  'auth.demoPreparing': 'جارٍ تجهيز مساحة عملك…',

  'auth.brandEyebrow': 'إدارة العملاء المحتملين',
  'auth.brandHeadline': 'لا تدع الصفقات تضيع في جدول بيانات.',
  'auth.brandBody':
    'يمنح ليدبايلوت فرق الخدمات الصغيرة مكانًا واحدًا لتتبّع كل استفسار من أول تواصل حتى توقيع الصفقة.',
  'auth.brandPoint1': 'كل استفسار مُسجَّل ومُسنَد ومُتابَع',
  'auth.brandPoint2': 'مسار مبيعات مشترك يراه فريقك بالكامل',
  'auth.brandPoint3': 'يعمل بالعربية والإنجليزية، مع دعم كامل للاتجاه من اليمين إلى اليسار',

  /* -------------------------------------------------------------- *
   * Landing page
   * -------------------------------------------------------------- */
  'landing.skipToContent': 'تخطَّ إلى المحتوى',
  'landing.signIn': 'تسجيل الدخول',
  'landing.startDemo': 'ابدأ العرض التجريبي',
  'landing.openWorkspace': 'افتح مساحة عملك',

  'landing.heroEyebrow': 'إدارة العملاء المحتملين لشركات الخدمات',
  'landing.heroTitle': 'كل استفسار تتم متابعته.',
  'landing.heroSubtitle':
    'يمنح ليدبايلوت فريق المبيعات الصغير مكانًا مشتركًا واحدًا لتسجيل الاستفسارات وإسنادها ومتابعتها وإغلاقها — بالعربية أو الإنجليزية، على أي جهاز.',
  'landing.heroNote': 'دون بطاقة ودون تسجيل. يفتح العرض التجريبي مساحة عمل خاصة ببيانات حقيقية.',

  'landing.previewLabel': 'لوحة مسار المبيعات، عمود لكل مرحلة',

  'landing.featuresTitle': 'ماذا يقدّم',
  'landing.featuresSubtitle': 'أربعة أشياء منجزة كما ينبغي، بدلًا من أربعين نصف منجزة.',

  'landing.featurePipelineTitle': 'مسار مبيعات يراه الجميع',
  'landing.featurePipelineBody':
    'اسحب الصفقة بين المراحل فتنتقل في كل مكان دفعةً واحدة — في الجدول وصفحة التفاصيل وسجل النشاط. والمراحل خاصة بكل مساحة عمل، فسمِّها بالطريقة التي يتحدث بها فريقك بالفعل.',
  'landing.featureDashboardTitle': 'أرقام يمكن البناء عليها',
  'landing.featureDashboardBody':
    'معدّل التحويل والإيراد المتوقع ومصادر العملاء وتوزيع المراحل، محسوبة في قاعدة البيانات لا مقدَّرة تخمينًا. وكل رقم يقودك إلى العملاء الذين وراءه.',
  'landing.featureFollowUpsTitle': 'لا شيء يُنسى',
  'landing.featureFollowUpsBody':
    'احجز نقطة التواصل التالية على أي عميل، فتظهر متأخرة أو مستحقة اليوم أو خلال الأسبوع — لتكون الصفقات التي تحتاج اتصالًا أول ما تراه.',
  'landing.featureBilingualTitle': 'ثنائي اللغة فعلًا',
  'landing.featureBilingualBody':
    'ليست مجرد نصوص مترجمة داخل واجهة من اليسار إلى اليمين. العربية تعكس الواجهة بالكامل — التنقل والجداول والرسوم البيانية والسحب والإفلات — مع التواريخ والأرقام والعملة المناسبة.',

  'landing.howTitle': 'كيف يعمل',
  'landing.howStep1Title': 'سجّل الاستفسار',
  'landing.howStep1Body': 'الاسم والخدمة والقيمة والمصدر في نموذج قصير، فيظهر أعلى عمود «جديد».',
  'landing.howStep2Title': 'أسنِد وتابِع',
  'landing.howStep2Body': 'أسنده إلى مندوب، وسجّل المكالمة، واحجز المتابعة. وكل تغيير يُوثَّق.',
  'landing.howStep3Title': 'أغلِق وتعلَّم',
  'landing.howStep3Body':
    'انقله إلى «تم الفوز»، أو إلى «خسارة» مع ذكر السبب. ولوحة التحكم تحوّل كليهما إلى معلومة مفيدة.',

  'landing.ctaTitle': 'ألقِ نظرة أولًا.',
  'landing.ctaBody':
    'يفتح العرض التجريبي مساحة عمل خاصة بك وحدك — {count} عميل محتمل وسجل سنة كاملة، غيّر فيها ما تشاء. لا يراها أحد غيرك، وتُحذف بعد يوم.',

  'landing.footerTagline': 'إدارة ثنائية اللغة للعملاء المحتملين للشركات الصغيرة والمتوسطة.',
  'landing.footerBuilt': 'مشروع لعرض الأعمال، مبنيّ بمعايير الإنتاج.',

  /* -------------------------------------------------------------- *
   * Bulk selection
   * -------------------------------------------------------------- */
  'bulk.selectAll': 'تحديد كل العملاء في هذه الصفحة',
  'bulk.selectRow': 'تحديد {name}',
  'bulk.locked': 'مُسنَد إلى شخص آخر — لا يغيّره سوى المالك أو المسؤول',
  'bulk.actions': 'إجراءات جماعية',
  'bulk.selected_zero': 'لم يُحدَّد شيء',
  'bulk.selected_one': 'تم تحديد عنصر واحد',
  'bulk.selected_two': 'تم تحديد عنصرين',
  'bulk.selected_few': 'تم تحديد {count} عناصر',
  'bulk.selected_many': 'تم تحديد {count} عنصرًا',
  'bulk.selected_other': 'تم تحديد {count} عنصر',
  'bulk.clear': 'إلغاء التحديد',
  'bulk.moveToStage': 'النقل إلى مرحلة',
  'bulk.assignTo': 'الإسناد إلى',
  'bulk.archive': 'أرشفة',
  'bulk.restore': 'استعادة',
  'bulk.updated_zero': 'لم يتم تحديث أي عميل',
  'bulk.updated_one': 'تم تحديث عميل واحد',
  'bulk.updated_two': 'تم تحديث عميلين',
  'bulk.updated_few': 'تم تحديث {count} عملاء',
  'bulk.updated_many': 'تم تحديث {count} عميلًا',
  'bulk.updated_other': 'تم تحديث {count} عميل',
  'bulk.notPermitted': 'بقي {count} محددًا — لا يمكن تغيير سوى العملاء المُسنَدين إليك',
  'bulk.alreadyDone': '{count} كانت محدَّثة بالفعل',
  'bulk.noneAllowed': 'لا يمكنك تغيير أي من هؤلاء العملاء',
  'bulk.nothingToDo': 'لا شيء في هذا التحديد يحتاج إلى تغيير',
  'bulk.failed': 'تعذّر تطبيق ذلك على كل العملاء',
  'bulk.archiveTitle_one': 'أرشفة عميل واحد؟',
  'bulk.archiveTitle_two': 'أرشفة عميلين؟',
  'bulk.archiveTitle_few': 'أرشفة {count} عملاء؟',
  'bulk.archiveTitle_many': 'أرشفة {count} عميلًا؟',
  'bulk.archiveTitle_other': 'أرشفة {count} عميل؟',
  'bulk.archiveBody':
    'سيخرجون من مسار المبيعات ومن جميع الإجماليات. ويُحفظ سجل نشاطهم ومتابعاتهم، ويمكن لمالك أو مسؤول استعادتهم من عامل تصفية «المؤرشفة».',
  'bulk.markLostTitle_one': 'تعليم عميل واحد كخسارة؟',
  'bulk.markLostTitle_two': 'تعليم عميلين كخسارة؟',
  'bulk.markLostTitle_few': 'تعليم {count} عملاء كخسارة؟',
  'bulk.markLostTitle_many': 'تعليم {count} عميلًا كخسارة؟',
  'bulk.markLostTitle_other': 'تعليم {count} عميل كخسارة؟',

  /* -------------------------------------------------------------- *
   * Leads list
   * -------------------------------------------------------------- */
  'leads.title': 'العملاء المحتملون',
  'leads.description': 'كل استفسارات {organization} في مكان واحد.',
  'leads.newLead': 'عميل محتمل جديد',
  'leads.couldNotLoad': 'تعذّر تحميل العملاء المحتملين',
  'leads.noMatchTitle': 'لا يوجد عملاء يطابقون عوامل التصفية',
  'leads.noMatchBody': 'وسّع نطاق البحث، أو امسح عوامل التصفية لعرض المسار بالكامل.',
  'leads.emptyTitle': 'لا يوجد عملاء محتملون بعد',
  'leads.emptyBody': 'أضف أول استفسار وسيظهر هنا مع سجل نشاطه الكامل.',
  'leads.itemLabel': 'عميل محتمل',

  'leads.column.customer': 'العميل',
  'leads.column.service': 'الخدمة',
  'leads.column.stage': 'المرحلة',
  'leads.column.value': 'القيمة',
  'leads.column.priority': 'الأولوية',
  'leads.column.assignee': 'المندوب',
  'leads.column.followUp': 'المتابعة القادمة',
  'leads.column.updated': 'آخر تحديث',
  'leads.sortBy': 'ترتيب حسب {label}',

  'leads.stat.open': 'العملاء النشطون',
  'leads.stat.openHint': '{total} في هذا العرض',
  'leads.stat.pipelineValue': 'قيمة المسار',
  'leads.stat.pipelineValueHint': 'القيمة التقديرية للعملاء النشطين',
  'leads.stat.won': 'الصفقات الرابحة',
  'leads.stat.wonHintNoRate': '{count} صفقة مغلقة',
  'leads.stat.wonHint': '{count} صفقة · نسبة فوز {rate}٪',
  'leads.stat.overdue': 'متابعات متأخرة',
  'leads.stat.overdueHint': 'تحتاج إلى انتباهك اليوم',
  'leads.stat.nothingOverdue': 'لا يوجد تأخير',

  /* -------------------------------------------------------------- *
   * Filters
   * -------------------------------------------------------------- */
  'filters.searchPlaceholder': 'ابحث بالاسم أو الشركة أو البريد أو الهاتف…',
  'filters.searchLeads': 'البحث في العملاء المحتملين',
  'filters.searchPipeline': 'ابحث في مسار المبيعات…',
  'filters.stage': 'المرحلة',
  'filters.assignee': 'المسؤول',
  'filters.source': 'المصدر',
  'filters.priority': 'الأولوية',
  'filters.followUp': 'تصفية حسب المتابعة',
  'filters.openOnly': 'النشطة فقط',
  'filters.archived': 'المؤرشفة',
  'filters.archivedTitle': 'عرض العملاء المؤرشفين',
  'filters.sort': 'ترتيب حسب',
  'filters.sortAscending': 'مرتّب تصاعديًا — التبديل إلى تنازلي',
  'filters.sortDescending': 'مرتّب تنازليًا — التبديل إلى تصاعدي',
  'filters.ascending': 'تصاعدي',
  'filters.descending': 'تنازلي',

  'pagination.rows': 'الصفوف',
  'pagination.rowsPerPage': 'عدد الصفوف في الصفحة',
  'pagination.previous': 'الصفحة السابقة',
  'pagination.next': 'الصفحة التالية',
  'pagination.page': 'صفحة {page} من {total}',
  'pagination.empty': 'لا يوجد {items}',
  'pagination.range': 'عرض {from}–{to} من {total} {items}',

  /* -------------------------------------------------------------- *
   * Lead detail
   * -------------------------------------------------------------- */
  'lead.allLeads': 'كل العملاء المحتملين',
  'lead.missing': 'لم يعد هذا العميل موجودًا',
  'lead.couldNotLoad': 'تعذّر تحميل بيانات هذا العميل',
  'lead.backToLeads': 'العودة إلى القائمة',
  'lead.edit': 'تعديل',
  'lead.editDetails': 'تعديل التفاصيل',
  'lead.moreActions': 'إجراءات أخرى',
  'lead.archive': 'أرشفة العميل',
  'lead.archivedTitle': 'هذا العميل مؤرشف',
  'lead.archivedBody': 'أُرشف في {date}. وهو مخفي من مسار المبيعات ومن جميع الإجماليات.',
  'lead.restore': 'إعادته إلى المسار',
  'lead.restored': 'تمت إعادة العميل إلى المسار',
  'lead.couldNotRestore': 'تعذّرت إعادة هذا العميل',
  'lead.archived': 'تمت أرشفة العميل',
  'lead.archivedDescription': '{name} — يُحفظ سجلّه ويمكن لمسؤول استعادته.',
  'lead.couldNotArchive': 'تعذّرت أرشفة هذا العميل',
  'lead.archiveConfirmTitle': 'أرشفة هذا العميل؟',
  'lead.archiveConfirmBody_zero':
    'سيُزال {name} من مسار المبيعات ومن جميع الإجماليات. وتُحفظ متابعاته، ويمكن لمالك أو مسؤول استعادته من عامل تصفية «المؤرشفة».',
  'lead.archiveConfirmBody_one':
    'سيُزال {name} من مسار المبيعات ومن جميع الإجماليات. ويُحفظ سجل النشاط الوحيد الخاص به وأي متابعات، ويمكن لمالك أو مسؤول استعادته من عامل تصفية «المؤرشفة».',
  'lead.archiveConfirmBody_two':
    'سيُزال {name} من مسار المبيعات ومن جميع الإجماليات. ويُحفظ سجلّا النشاط الخاصان به وأي متابعات، ويمكن لمالك أو مسؤول استعادته من عامل تصفية «المؤرشفة».',
  'lead.archiveConfirmBody_few':
    'سيُزال {name} من مسار المبيعات ومن جميع الإجماليات. وتُحفظ سجلات النشاط الـ{count} الخاصة به وأي متابعات، ويمكن لمالك أو مسؤول استعادته من عامل تصفية «المؤرشفة».',
  'lead.archiveConfirmBody_many':
    'سيُزال {name} من مسار المبيعات ومن جميع الإجماليات. ويُحفظ {count} سجلًّا من سجلات نشاطه وأي متابعات، ويمكن لمالك أو مسؤول استعادته من عامل تصفية «المؤرشفة».',
  'lead.archiveConfirmBody_other':
    'سيُزال {name} من مسار المبيعات ومن جميع الإجماليات. وتُحفظ سجلات نشاطه البالغة {count} وأي متابعات، ويمكن لمالك أو مسؤول استعادته من عامل تصفية «المؤرشفة».',
  'lead.reasonLost': 'سبب الخسارة',

  'lead.logUpdate': 'تسجيل تحديث',
  'lead.activity': 'النشاط',
  'lead.activityAll': 'الكل',
  'lead.activityNotes': 'الملاحظات والمكالمات',
  'lead.activityShowing': 'عرض {shown} من {total}',
  'lead.activityShowOlder': 'عرض نشاط أقدم',

  'lead.contact': 'بيانات التواصل',
  'lead.noEmail': 'لا يوجد بريد إلكتروني مسجّل',
  'lead.noPhone': 'لا يوجد رقم هاتف مسجّل',
  'lead.details': 'التفاصيل',
  'lead.assignedRep': 'المندوب المسؤول',
  'lead.estimatedValue': 'القيمة التقديرية',
  'lead.requestedService': 'الخدمة المطلوبة',
  'lead.source': 'مصدر العميل',
  'lead.priority': 'الأولوية',
  'lead.nextFollowUp': 'المتابعة القادمة',
  'lead.lastContacted': 'آخر تواصل',
  'lead.notYet': 'لم يتم بعد',
  'lead.created': 'تاريخ الإنشاء',
  'lead.createdBy': 'بواسطة {name}',
  'lead.wonOn': 'تاريخ الفوز',
  'lead.pipelineStage': 'مرحلة المسار',
  'lead.moving': 'جارٍ النقل…',
  'lead.movedTo': 'تم النقل إلى {stage}',
  'lead.couldNotMove': 'تعذّر نقل العميل',
  'lead.markLostTitle': 'تعليم هذا العميل كخسارة؟',
  'lead.markLostBody': 'ذكر سبب مختصر يساعد الفريق على اكتشاف الأنماط لاحقًا. ويمكنك تركه فارغًا.',
  'lead.lostReasonLabel': 'السبب',
  'lead.lostReasonPlaceholder': 'اختار منافسًا بخطة سداد أقصر…',
  'lead.markAsLost': 'تعليمه كخسارة',
  'lead.assignedTo': 'أُسنِد إلى {name}',
  'lead.nowUnassigned': 'أصبح العميل غير مُسنَد',
  'lead.couldNotReassign': 'تعذّرت إعادة الإسناد',

  /* -------------------------------------------------------------- *
   * Lead form
   * -------------------------------------------------------------- */
  'leadForm.editTitle': 'تعديل العميل المحتمل',
  'leadForm.createTitle': 'عميل محتمل جديد',
  'leadForm.editDescription': 'حدّث بيانات هذا العميل.',
  'leadForm.createDescription': 'سجّل الاستفسار حتى لا يضيع.',
  'leadForm.customerName': 'اسم العميل *',
  'leadForm.customerNamePlaceholder': 'أحمد المنصوري',
  'leadForm.company': 'الشركة',
  'leadForm.companyPlaceholder': 'شركة أفق الخليج القابضة',
  'leadForm.email': 'البريد الإلكتروني',
  'leadForm.emailPlaceholder': 'ahmed@example.com',
  'leadForm.phone': 'الهاتف',
  'leadForm.phonePlaceholder': '+971 50 123 4567',
  'leadForm.requestedService': 'الخدمة المطلوبة *',
  'leadForm.requestedServicePlaceholder': 'الاستثمار في شقة على الخارطة',
  'leadForm.estimatedValue': 'القيمة التقديرية',
  'leadForm.notes': 'ملاحظات',
  'leadForm.notesPlaceholder': 'أي معلومة يحتاجها الفريق قبل أول اتصال…',
  'leadForm.save': 'حفظ التغييرات',
  'leadForm.create': 'إنشاء العميل',
  'leadForm.created': 'تم إنشاء العميل',
  'leadForm.updated': 'تم تحديث العميل',

  /* -------------------------------------------------------------- *
   * Activity timeline
   * -------------------------------------------------------------- */
  'activity.couldNotLoad': 'تعذّر تحميل النشاط',
  'activity.emptyTitle': 'لم يُسجَّل شيء بعد',
  'activity.emptyBody':
    'أضف أول ملاحظة أو سجّل مكالمة — كل ما يفعله الفريق مع هذا العميل يظهر هنا.',
  'activity.someone': 'أحد الأعضاء',
  'activity.teammate': 'أحد الزملاء',
  'activity.created': 'أنشأ {actor} هذا العميل',
  'activity.stageChanged': 'نقل {actor} العميل من {from} إلى {to}',
  'activity.assigned': 'أسنَد {actor} هذا العميل إلى {assignee}',
  'activity.unassigned': 'أزال {actor} المندوب المسؤول',
  'activity.fieldUpdated': 'حدّث {actor} {field}',
  'activity.fieldUpdatedTo': 'حدّث {actor} {field} إلى {value}',
  'activity.aField': 'أحد الحقول',
  'activity.followUpScheduled': 'جدول {actor} متابعة {title}',
  'activity.followUpScheduledFor': 'جدول {actor} متابعة {title} في {date}',
  'activity.followUpCompleted': 'أكمل {actor} متابعة {title}',
  'activity.followUpCancelled': 'ألغى {actor} متابعة {title}',
  'activity.loggedCall': 'سجّل {actor} مكالمة',
  'activity.loggedEmail': 'سجّل {actor} رسالة بريد إلكتروني',
  'activity.loggedMeeting': 'سجّل {actor} اجتماعًا',
  'activity.loggedWhatsapp': 'سجّل {actor} رسالة واتساب',
  'activity.addedNote': 'أضاف {actor} ملاحظة',
  'activity.addedEntry': 'أضاف {actor} سجلًّا',
  'activity.unknownStage': 'غير معروفة',

  'composer.label': 'إضافة ملاحظة',
  'composer.placeholder': 'ماذا حدث؟ سجّل مكالمة أو بريدًا أو اترك ملاحظة للفريق…',
  'composer.tooLong': 'النص أطول بمقدار {count} حرفًا.',
  'composer.entryType': 'نوع السجل',
  'composer.submit': 'إضافة',
  'composer.added': 'أُضيف إلى السجل الزمني',
  'composer.couldNotSave': 'تعذّر حفظ ذلك',

  /* -------------------------------------------------------------- *
   * Follow-ups
   * -------------------------------------------------------------- */
  'followUp.title': 'المتابعات',
  'followUp.openCount': '{count} مفتوحة',
  'followUp.schedule': 'جدولة متابعة',
  'followUp.whatNeedsDoing': 'ما المطلوب فعله؟',
  'followUp.titlePlaceholder': 'الاتصال لتأكيد موعد المعاينة',
  'followUp.due': 'الاستحقاق',
  'followUp.channel': 'القناة',
  'followUp.notes': 'ملاحظات (اختياري)',
  'followUp.notesPlaceholder': 'يفضّل الاتصال بعد السادسة مساءً…',
  'followUp.submit': 'جدولة',
  'followUp.scheduled': 'تمت جدولة المتابعة',
  'followUp.couldNotSchedule': 'تعذّرت جدولة ذلك',
  'followUp.couldNotLoad': 'تعذّر تحميل المتابعات',
  'followUp.emptyTitle': 'لا توجد متابعات مجدولة',
  'followUp.emptyBody': 'احجز نقطة التواصل التالية حتى لا ينقطع التواصل مع هذا العميل.',
  'followUp.past': 'السابقة',
  'followUp.cancelled': 'ملغاة',
  'followUp.completedAt': 'اكتملت في {date}',
  'followUp.markComplete': 'تعليم «{title}» كمكتملة',
  'followUp.cancelOne': 'إلغاء «{title}»',
  'followUp.completed': 'اكتملت المتابعة',
  'followUp.couldNotComplete': 'تعذّر إكمال تلك المتابعة',
  'followUp.wasCancelled': 'أُلغيت المتابعة',
  'followUp.couldNotCancel': 'تعذّر إلغاء تلك المتابعة',

  /* -------------------------------------------------------------- *
   * Pipeline board
   * -------------------------------------------------------------- */
  'board.title': 'مسار المبيعات',
  'board.description': '{leads} عميل محتمل · {value} في المسار النشط',
  'board.fallbackDescription': 'كل صفقات {organization} مرتّبة حسب المرحلة.',
  'board.couldNotLoad': 'تعذّر تحميل مسار المبيعات',
  'board.noMatchTitle': 'لا يوجد عملاء يطابقون عوامل التصفية',
  'board.noMatchBody': 'المراحل أدناه ما زالت قائمة — لكن أيًّا منها لا يضم عميلًا مطابقًا.',
  'board.emptyTitle': 'مسار المبيعات فارغ',
  'board.emptyBody': 'أضف أول استفسار وسيظهر في عمود «جديد».',
  'board.columnLabel': '{stage} — {count} عميل محتمل',
  'board.dropHere': 'أفلت هنا للنقل',
  'board.stageEmpty': 'لا يوجد شيء في هذه المرحلة',
  'board.showMore': 'عرض {count} إضافية',
  'board.loadedOf': '({shown} من {total})',
  'board.viewAllInTable': 'عرض الكل ({count}) في الجدول',
  'board.moveToStage': 'النقل إلى مرحلة',
  'board.moveCard': 'نقل {name} إلى مرحلة أخرى',
  'board.reorderCard': 'إعادة ترتيب {name}',
  'board.locked': 'لا يمكنك نقل هذا العميل',
  'board.lockedHint': 'مُسنَد إلى شخص آخر — لا ينقله سوى المالك أو المسؤول',
  'board.markLostTitle': 'تعليم {name} كخسارة؟',
  'board.thisLead': 'هذا العميل',

  /* -------------------------------------------------------------- *
   * Dashboard
   * -------------------------------------------------------------- */
  'dashboard.title': 'لوحة التحكم',
  'dashboard.couldNotLoad': 'تعذّر تحميل لوحة التحكم',
  'dashboard.reportingFrom': '{organization} · تقارير اعتبارًا من {date}',
  'dashboard.period': 'فترة التقرير',
  'dashboard.range.30d': 'آخر 30 يومًا',
  'dashboard.range.90d': 'آخر 90 يومًا',
  'dashboard.range.12m': 'آخر 12 شهرًا',
  'dashboard.rangeInline.30d': 'آخر 30 يومًا',
  'dashboard.rangeInline.90d': 'آخر 90 يومًا',
  'dashboard.rangeInline.12m': 'آخر 12 شهرًا',
  'dashboard.previous.30d': '30 يومًا',
  'dashboard.previous.90d': '90 يومًا',
  'dashboard.previous.12m': 'سنة',

  'dashboard.newLeads': 'عملاء محتملون جدد',
  'dashboard.newLeadsHint': 'مقابل {count} في الـ{period} السابقة',
  'dashboard.newLeadsExplainer':
    'العملاء الذين أُنشئوا خلال {range}، مقارنةً بالـ{period} السابقة.',
  'dashboard.conversionRate': 'معدّل التحويل',
  'dashboard.conversionNone': 'لم تُغلق أي صفقة في هذه الفترة',
  'dashboard.conversionNoPrior': '{count} صفقة مغلقة · لا توجد بيانات سابقة',
  'dashboard.conversionHint': '{count} صفقة مغلقة · {rate}٪ في الـ{period} السابقة',
  'dashboard.conversionExplainer':
    'الصفقات الرابحة كنسبة من الصفقات المغلقة — الرابحة والخاسرة — خلال الفترة المحددة. ولا تُحتسب الصفقات النشطة، لأن الصفقة التي لم تُحسم ليست خسارة.',
  'dashboard.expectedRevenue': 'الإيراد المتوقع',
  'dashboard.expectedRevenueHint': 'من أصل {value} في المسار النشط',
  'dashboard.expectedRevenueExplainer':
    'قيمة كل عميل نشط مضروبة في احتمالية الفوز الخاصة بمرحلته، ثم يُجمع الناتج. فعرض السعر يزن أكثر من استفسار لم يُلمس بعد، ولذلك يقل هذا الرقم كثيرًا عن قيمة المسار الإجمالية — وهذا مقصود.',
  'dashboard.wonRevenue': 'الإيراد المحقّق',
  'dashboard.wonRevenueHint': '{count} صفقة',
  'dashboard.wonRevenueHintAvg': '{count} صفقة · بمتوسط {average}',
  'dashboard.wonRevenueExplainer': 'قيمة الصفقات المُعلَّمة كرابحة خلال {range}.',
  'dashboard.noPriorData': 'لا توجد بيانات سابقة',
  'dashboard.flat': 'دون تغيير',

  'dashboard.trendTitle': 'تدفّق العملاء والصفقات المغلقة',
  'dashboard.trendDescription': 'العملاء الجدد لكل {bucket} مقابل الصفقات الرابحة، خلال {range}.',
  'dashboard.bucket.week': 'أسبوع',
  'dashboard.bucket.month': 'شهر',
  'dashboard.trendEmptyTitle': 'لا توجد بيانات في هذه الفترة',
  'dashboard.trendEmptyBody': 'لم يُنشأ أي عميل ولم تُغلق أي صفقة في الفترة المحددة.',
  'dashboard.weekOf': 'أسبوع {label}',
  'dashboard.dealsWon': 'الصفقات الرابحة',
  'dashboard.wonValue': 'قيمة الصفقات الرابحة',

  'dashboard.followUpsTitle': 'المتابعات',
  'dashboard.followUpsDescription': 'المهام المفتوحة الآن — لا تتأثر بفترة التقرير.',
  'dashboard.followUpOverdue': 'متأخرة',
  'dashboard.followUpToday': 'اليوم',
  'dashboard.followUpThisWeek': 'هذا الأسبوع',
  'dashboard.followUpLater': 'لاحقًا',
  'dashboard.followUpsEmptyTitle': 'لا يوجد شيء مجدول',
  'dashboard.followUpsEmptyBody': 'تظهر هنا المتابعات التي تحجزها على أي عميل.',
  'dashboard.nextUp': 'التالي',
  'dashboard.lead': 'عميل محتمل',

  'dashboard.stagesTitle': 'المسار حسب المرحلة',
  'dashboard.stagesDescription': '{count} عميل نشط الآن · متوسط زمن الإغلاق {days}',
  'dashboard.stagesFallback': 'أين يقف المسار النشط في الوقت الحالي.',
  'dashboard.pipelineValue': 'قيمة المسار',
  'dashboard.weightedLegend': 'مرجّحة باحتمالية الفوز لكل مرحلة',
  'dashboard.weightedAt': 'مرجّحة بنسبة {percent}٪',
  'dashboard.averageAge': 'متوسط العمر',
  'dashboard.tableStage': 'المرحلة',
  'dashboard.tableLeads': 'العملاء',
  'dashboard.tableValue': 'القيمة',
  'dashboard.tableAvgAge': 'متوسط العمر',

  'dashboard.sourcesTitle': 'مصادر العملاء',
  'dashboard.sourcesDescription': 'من أين جاء عملاء {range}، وكفاءة كل مصدر في التحويل.',
  'dashboard.sourcesEmptyTitle': 'لا يوجد عملاء في هذه الفترة',
  'dashboard.sourcesEmptyBody': 'يظهر توزيع المصادر بمجرد إنشاء عملاء خلال الفترة المحددة.',
  'dashboard.otherSources': '{count} مصدر آخر',
  'dashboard.conversion': 'التحويل',
  'dashboard.conversionOfClosed': '{rate}٪ من {closed} صفقة مغلقة',
  'dashboard.leadsWithShare': '{count} ({share}٪)',

  'dashboard.footnote':
    'الأرقام معروضة بعملة مساحة العمل ({currency}). تعرض لوحتا المسار والمتابعات الحالة الراهنة، بينما يغطي ما عداهما الفترة المحددة.',

  /* -------------------------------------------------------------- *
   * Team
   * -------------------------------------------------------------- */
  'team.title': 'الفريق',
  'team.description': 'كل من لديه صلاحية الوصول إلى {organization}.',
  'team.empty': 'لا يوجد أعضاء بعد',
  'team.deactivated': 'معطّل',
  'team.activeAgo': 'نشِط {when}',
  'team.neverSignedIn': 'لم يسجّل الدخول قط',
  'team.footnote': 'ستصل دعوة الأعضاء وتغيير الأدوار مع إعدادات المسؤول في إصدار لاحق.',

  /* -------------------------------------------------------------- *
   * Enumerations
   * -------------------------------------------------------------- */
  'source.WEBSITE': 'الموقع الإلكتروني',
  'source.REFERRAL': 'ترشيح',
  'source.SOCIAL_MEDIA': 'وسائل التواصل',
  'source.PAID_ADS': 'إعلانات مدفوعة',
  'source.COLD_CALL': 'اتصال مباشر',
  'source.EMAIL_CAMPAIGN': 'حملة بريدية',
  'source.EVENT': 'فعالية',
  'source.WALK_IN': 'زيارة مباشرة',
  'source.PARTNER': 'شريك',
  'source.MARKETPLACE': 'منصة وسيطة',
  'source.OTHER': 'أخرى',

  'priority.LOW': 'منخفضة',
  'priority.MEDIUM': 'متوسطة',
  'priority.HIGH': 'عالية',
  'priority.URGENT': 'عاجلة',

  'stage.NEW': 'جديد',
  'stage.CONTACTED': 'تم التواصل',
  'stage.QUALIFIED': 'مؤهل',
  'stage.PROPOSAL': 'عرض سعر',
  'stage.WON': 'تم الفوز',
  'stage.LOST': 'خسارة',

  'role.OWNER': 'المالك',
  'role.ADMIN': 'مسؤول',
  'role.MEMBER': 'مندوب مبيعات',

  'channel.CALL': 'مكالمة',
  'channel.EMAIL': 'بريد إلكتروني',
  'channel.MEETING': 'اجتماع',
  'channel.WHATSAPP': 'واتساب',
  'channel.SMS': 'رسالة نصية',
  'channel.OTHER': 'أخرى',

  'activityType.NOTE': 'ملاحظة',
  'activityType.CALL': 'مكالمة',
  'activityType.EMAIL': 'بريد إلكتروني',
  'activityType.MEETING': 'اجتماع',
  'activityType.WHATSAPP': 'واتساب',
  'activityType.LEAD_CREATED': 'إنشاء العميل',
  'activityType.STAGE_CHANGED': 'تغيير المرحلة',
  'activityType.ASSIGNED': 'الإسناد',
  'activityType.FIELD_UPDATED': 'تحديث التفاصيل',
  'activityType.FOLLOW_UP_SCHEDULED': 'جدولة متابعة',
  'activityType.FOLLOW_UP_COMPLETED': 'إكمال متابعة',
  'activityType.FOLLOW_UP_CANCELLED': 'إلغاء متابعة',

  'leadField.customerName': 'اسم العميل',
  'leadField.company': 'الشركة',
  'leadField.email': 'البريد الإلكتروني',
  'leadField.phone': 'الهاتف',
  'leadField.requestedService': 'الخدمة المطلوبة',
  'leadField.estimatedValue': 'القيمة التقديرية',
  'leadField.priority': 'الأولوية',
  'leadField.source': 'مصدر العميل',

  'sort.updatedAt': 'آخر تحديث',
  'sort.createdAt': 'تاريخ الإنشاء',
  'sort.customerName': 'اسم العميل',
  'sort.company': 'الشركة',
  'sort.estimatedValue': 'القيمة التقديرية',
  'sort.nextFollowUpAt': 'المتابعة القادمة',
  'sort.lastActivityAt': 'آخر نشاط',
  'sort.stage': 'مرحلة المسار',
  'sort.priority': 'الأولوية',

  'followUpFilter.any': 'أي متابعة',
  'followUpFilter.overdue': 'متأخرة',
  'followUpFilter.today': 'مستحقة اليوم',
  'followUpFilter.week': 'مستحقة هذا الأسبوع',
  'followUpFilter.none': 'بلا متابعة',

  /* -------------------------------------------------------------- *
   * Dates
   * -------------------------------------------------------------- */
  'due.none': 'لا توجد متابعة',
  'due.overdue_zero': 'متأخرة',
  'due.overdue_one': 'متأخرة بيوم واحد',
  'due.overdue_two': 'متأخرة بيومين',
  'due.overdue_few': 'متأخرة بـ{count} أيام',
  'due.overdue_many': 'متأخرة بـ{count} يومًا',
  'due.overdue_other': 'متأخرة بـ{count} يوم',
  'due.today': 'اليوم، {time}',
  'due.tomorrow': 'غدًا، {time}',
  'relative.justNow': 'الآن',
};
