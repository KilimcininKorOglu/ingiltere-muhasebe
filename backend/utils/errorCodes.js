/**
 * Error Codes Utility
 * Centralizes error codes for consistent error handling across the backend.
 * Each error code maps to bilingual messages (English/Turkish) for frontend consumption.
 */

/**
 * HTTP Status codes
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * Error Categories
 */
const ERROR_CATEGORY = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  RESOURCE: 'resource',
  BUSINESS: 'business',
  SYSTEM: 'system',
  NETWORK: 'network',
  RATE_LIMIT: 'rateLimit',
};

/**
 * Comprehensive error codes with bilingual messages
 * Each error code includes:
 * - code: Unique error identifier
 * - httpStatus: HTTP status code to use
 * - category: Error category for grouping
 * - message: Bilingual messages (en/tr)
 */
const ERROR_CODES = {
  // ==========================================
  // VALIDATION ERRORS (VAL_*)
  // ==========================================
  VAL_REQUIRED_FIELD: {
    code: 'VAL_REQUIRED_FIELD',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'This field is required',
      tr: 'Bu alan zorunludur',
    },
  },
  VAL_INVALID_EMAIL: {
    code: 'VAL_INVALID_EMAIL',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Please enter a valid email address',
      tr: 'Lütfen geçerli bir e-posta adresi girin',
    },
  },
  VAL_INVALID_FORMAT: {
    code: 'VAL_INVALID_FORMAT',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'The provided value is in an invalid format',
      tr: 'Girilen değer geçersiz bir formatta',
    },
  },
  VAL_MIN_LENGTH: {
    code: 'VAL_MIN_LENGTH',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Must be at least {{min}} characters',
      tr: 'En az {{min}} karakter olmalıdır',
    },
  },
  VAL_MAX_LENGTH: {
    code: 'VAL_MAX_LENGTH',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Must be no more than {{max}} characters',
      tr: 'En fazla {{max}} karakter olmalıdır',
    },
  },
  VAL_INVALID_POSTCODE: {
    code: 'VAL_INVALID_POSTCODE',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Please enter a valid UK postcode',
      tr: 'Lütfen geçerli bir UK posta kodu girin',
    },
  },
  VAL_INVALID_PHONE: {
    code: 'VAL_INVALID_PHONE',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Please enter a valid UK phone number',
      tr: 'Lütfen geçerli bir UK telefon numarası girin',
    },
  },
  VAL_INVALID_VAT_NUMBER: {
    code: 'VAL_INVALID_VAT_NUMBER',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Please enter a valid UK VAT number (e.g., GB123456789)',
      tr: 'Lütfen geçerli bir UK KDV numarası girin (örn. GB123456789)',
    },
  },
  VAL_INVALID_COMPANY_NUMBER: {
    code: 'VAL_INVALID_COMPANY_NUMBER',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Please enter a valid UK company registration number',
      tr: 'Lütfen geçerli bir UK şirket sicil numarası girin',
    },
  },
  VAL_INVALID_UTR: {
    code: 'VAL_INVALID_UTR',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Please enter a valid 10-digit Unique Taxpayer Reference',
      tr: 'Lütfen geçerli bir 10 haneli Vergi Mükellefi Referans numarası girin',
    },
  },
  VAL_INVALID_NINO: {
    code: 'VAL_INVALID_NINO',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Please enter a valid National Insurance number (e.g., AB123456C)',
      tr: 'Lütfen geçerli bir Ulusal Sigorta numarası girin (örn. AB123456C)',
    },
  },
  VAL_INVALID_SORT_CODE: {
    code: 'VAL_INVALID_SORT_CODE',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Please enter a valid sort code (e.g., 12-34-56)',
      tr: 'Lütfen geçerli bir banka sıralama kodu girin (örn. 12-34-56)',
    },
  },
  VAL_INVALID_BANK_ACCOUNT: {
    code: 'VAL_INVALID_BANK_ACCOUNT',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Please enter a valid 8-digit bank account number',
      tr: 'Lütfen geçerli bir 8 haneli banka hesap numarası girin',
    },
  },
  VAL_INVALID_INVOICE_NUMBER: {
    code: 'VAL_INVALID_INVOICE_NUMBER',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Please enter a valid invoice number',
      tr: 'Lütfen geçerli bir fatura numarası girin',
    },
  },
  VAL_INVALID_CURRENCY: {
    code: 'VAL_INVALID_CURRENCY',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Please enter a valid currency amount',
      tr: 'Lütfen geçerli bir para birimi tutarı girin',
    },
  },
  VAL_INVALID_PERCENTAGE: {
    code: 'VAL_INVALID_PERCENTAGE',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Please enter a valid percentage (0-100)',
      tr: 'Lütfen geçerli bir yüzde girin (0-100)',
    },
  },
  VAL_MUST_BE_POSITIVE: {
    code: 'VAL_MUST_BE_POSITIVE',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Value must be greater than zero',
      tr: 'Değer sıfırdan büyük olmalıdır',
    },
  },
  VAL_MUST_BE_NON_NEGATIVE: {
    code: 'VAL_MUST_BE_NON_NEGATIVE',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Value cannot be negative',
      tr: 'Değer negatif olamaz',
    },
  },
  VAL_FUTURE_DATE: {
    code: 'VAL_FUTURE_DATE',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Date cannot be in the future',
      tr: 'Tarih gelecekte olamaz',
    },
  },
  VAL_OUTSIDE_TAX_YEAR: {
    code: 'VAL_OUTSIDE_TAX_YEAR',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Date is outside the current tax year ({{startYear}}/{{endYear}})',
      tr: 'Tarih mevcut vergi yılının dışında ({{startYear}}/{{endYear}})',
    },
  },
  VAL_INVALID_DATE: {
    code: 'VAL_INVALID_DATE',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Please enter a valid date',
      tr: 'Lütfen geçerli bir tarih girin',
    },
  },
  VAL_INVALID_DATE_RANGE: {
    code: 'VAL_INVALID_DATE_RANGE',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'End date must be after start date',
      tr: 'Bitiş tarihi başlangıç tarihinden sonra olmalıdır',
    },
  },
  VAL_PASSWORD_MIN_LENGTH: {
    code: 'VAL_PASSWORD_MIN_LENGTH',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Password must be at least 8 characters',
      tr: 'Şifre en az 8 karakter olmalıdır',
    },
  },
  VAL_PASSWORD_CASE: {
    code: 'VAL_PASSWORD_CASE',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Password must contain both uppercase and lowercase letters',
      tr: 'Şifre hem büyük hem de küçük harf içermelidir',
    },
  },
  VAL_PASSWORD_NUMBER: {
    code: 'VAL_PASSWORD_NUMBER',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Password must contain at least one number',
      tr: 'Şifre en az bir rakam içermelidir',
    },
  },
  VAL_PASSWORD_MISMATCH: {
    code: 'VAL_PASSWORD_MISMATCH',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Passwords do not match',
      tr: 'Şifreler eşleşmiyor',
    },
  },
  VAL_INVALID_REGION: {
    code: 'VAL_INVALID_REGION',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Region must be "england" or "scotland"',
      tr: 'Bölge "england" veya "scotland" olmalıdır',
    },
  },
  VAL_ANNUAL_INCOME_REQUIRED: {
    code: 'VAL_ANNUAL_INCOME_REQUIRED',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Annual income is required',
      tr: 'Yıllık gelir gereklidir',
    },
  },
  VAL_ANNUAL_INCOME_POSITIVE: {
    code: 'VAL_ANNUAL_INCOME_POSITIVE',
    httpStatus: HTTP_STATUS.BAD_REQUEST,
    category: ERROR_CATEGORY.VALIDATION,
    message: {
      en: 'Annual income must be a positive number',
      tr: 'Yıllık gelir pozitif bir sayı olmalıdır',
    },
  },

  // ==========================================
  // AUTHENTICATION ERRORS (AUTH_*)
  // ==========================================
  AUTH_INVALID_CREDENTIALS: {
    code: 'AUTH_INVALID_CREDENTIALS',
    httpStatus: HTTP_STATUS.UNAUTHORIZED,
    category: ERROR_CATEGORY.AUTHENTICATION,
    message: {
      en: 'Invalid email or password',
      tr: 'Geçersiz e-posta veya şifre',
    },
  },
  AUTH_TOKEN_EXPIRED: {
    code: 'AUTH_TOKEN_EXPIRED',
    httpStatus: HTTP_STATUS.UNAUTHORIZED,
    category: ERROR_CATEGORY.AUTHENTICATION,
    message: {
      en: 'Your session has expired. Please log in again.',
      tr: 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.',
    },
  },
  AUTH_TOKEN_INVALID: {
    code: 'AUTH_TOKEN_INVALID',
    httpStatus: HTTP_STATUS.UNAUTHORIZED,
    category: ERROR_CATEGORY.AUTHENTICATION,
    message: {
      en: 'Invalid authentication token',
      tr: 'Geçersiz kimlik doğrulama jetonu',
    },
  },
  AUTH_TOKEN_MISSING: {
    code: 'AUTH_TOKEN_MISSING',
    httpStatus: HTTP_STATUS.UNAUTHORIZED,
    category: ERROR_CATEGORY.AUTHENTICATION,
    message: {
      en: 'Authentication is required',
      tr: 'Kimlik doğrulama gereklidir',
    },
  },
  AUTH_EMAIL_NOT_VERIFIED: {
    code: 'AUTH_EMAIL_NOT_VERIFIED',
    httpStatus: HTTP_STATUS.FORBIDDEN,
    category: ERROR_CATEGORY.AUTHENTICATION,
    message: {
      en: 'Please verify your email address to continue',
      tr: 'Devam etmek için lütfen e-posta adresinizi doğrulayın',
    },
  },
  AUTH_ACCOUNT_LOCKED: {
    code: 'AUTH_ACCOUNT_LOCKED',
    httpStatus: HTTP_STATUS.FORBIDDEN,
    category: ERROR_CATEGORY.AUTHENTICATION,
    message: {
      en: 'Your account has been locked due to too many failed attempts',
      tr: 'Hesabınız çok fazla başarısız deneme nedeniyle kilitlendi',
    },
  },
  AUTH_ACCOUNT_DISABLED: {
    code: 'AUTH_ACCOUNT_DISABLED',
    httpStatus: HTTP_STATUS.FORBIDDEN,
    category: ERROR_CATEGORY.AUTHENTICATION,
    message: {
      en: 'Your account has been disabled. Please contact support.',
      tr: 'Hesabınız devre dışı bırakıldı. Lütfen destek ile iletişime geçin.',
    },
  },

  // ==========================================
  // AUTHORIZATION ERRORS (AUTHZ_*)
  // ==========================================
  AUTHZ_FORBIDDEN: {
    code: 'AUTHZ_FORBIDDEN',
    httpStatus: HTTP_STATUS.FORBIDDEN,
    category: ERROR_CATEGORY.AUTHORIZATION,
    message: {
      en: 'You do not have permission to access this resource',
      tr: 'Bu kaynağa erişim izniniz yok',
    },
  },
  AUTHZ_INSUFFICIENT_PERMISSIONS: {
    code: 'AUTHZ_INSUFFICIENT_PERMISSIONS',
    httpStatus: HTTP_STATUS.FORBIDDEN,
    category: ERROR_CATEGORY.AUTHORIZATION,
    message: {
      en: 'You do not have sufficient permissions to perform this action',
      tr: 'Bu işlemi gerçekleştirmek için yeterli izniniz yok',
    },
  },
  AUTHZ_RESOURCE_OWNER_ONLY: {
    code: 'AUTHZ_RESOURCE_OWNER_ONLY',
    httpStatus: HTTP_STATUS.FORBIDDEN,
    category: ERROR_CATEGORY.AUTHORIZATION,
    message: {
      en: 'Only the owner can access this resource',
      tr: 'Bu kaynağa yalnızca sahibi erişebilir',
    },
  },

  // ==========================================
  // RESOURCE ERRORS (RES_*)
  // ==========================================
  RES_NOT_FOUND: {
    code: 'RES_NOT_FOUND',
    httpStatus: HTTP_STATUS.NOT_FOUND,
    category: ERROR_CATEGORY.RESOURCE,
    message: {
      en: 'The requested resource was not found',
      tr: 'İstenen kaynak bulunamadı',
    },
  },
  RES_ROUTE_NOT_FOUND: {
    code: 'RES_ROUTE_NOT_FOUND',
    httpStatus: HTTP_STATUS.NOT_FOUND,
    category: ERROR_CATEGORY.RESOURCE,
    message: {
      en: 'Page not found',
      tr: 'Sayfa bulunamadı',
    },
  },
  RES_TAX_YEAR_NOT_FOUND: {
    code: 'RES_TAX_YEAR_NOT_FOUND',
    httpStatus: HTTP_STATUS.NOT_FOUND,
    category: ERROR_CATEGORY.RESOURCE,
    message: {
      en: 'Tax rates for the specified year were not found',
      tr: 'Belirtilen yıl için vergi oranları bulunamadı',
    },
  },
  RES_TAX_TYPE_NOT_FOUND: {
    code: 'RES_TAX_TYPE_NOT_FOUND',
    httpStatus: HTTP_STATUS.NOT_FOUND,
    category: ERROR_CATEGORY.RESOURCE,
    message: {
      en: 'The specified tax type was not found',
      tr: 'Belirtilen vergi türü bulunamadı',
    },
  },
  RES_INCOME_TAX_CONFIG_NOT_FOUND: {
    code: 'RES_INCOME_TAX_CONFIG_NOT_FOUND',
    httpStatus: HTTP_STATUS.NOT_FOUND,
    category: ERROR_CATEGORY.RESOURCE,
    message: {
      en: 'Income tax configuration for the specified region was not found',
      tr: 'Belirtilen bölge için gelir vergisi yapılandırması bulunamadı',
    },
  },
  RES_VAT_RATES_NOT_FOUND: {
    code: 'RES_VAT_RATES_NOT_FOUND',
    httpStatus: HTTP_STATUS.NOT_FOUND,
    category: ERROR_CATEGORY.RESOURCE,
    message: {
      en: 'VAT rates for the specified year were not found',
      tr: 'Belirtilen yıl için KDV oranları bulunamadı',
    },
  },
  RES_CORPORATION_TAX_NOT_FOUND: {
    code: 'RES_CORPORATION_TAX_NOT_FOUND',
    httpStatus: HTTP_STATUS.NOT_FOUND,
    category: ERROR_CATEGORY.RESOURCE,
    message: {
      en: 'Corporation tax rates for the specified year were not found',
      tr: 'Belirtilen yıl için kurumlar vergisi oranları bulunamadı',
    },
  },
  RES_NI_RATES_NOT_FOUND: {
    code: 'RES_NI_RATES_NOT_FOUND',
    httpStatus: HTTP_STATUS.NOT_FOUND,
    category: ERROR_CATEGORY.RESOURCE,
    message: {
      en: 'National Insurance rates for the specified year were not found',
      tr: 'Belirtilen yıl için ulusal sigorta oranları bulunamadı',
    },
  },
  RES_INVOICE_NOT_FOUND: {
    code: 'RES_INVOICE_NOT_FOUND',
    httpStatus: HTTP_STATUS.NOT_FOUND,
    category: ERROR_CATEGORY.RESOURCE,
    message: {
      en: 'Invoice not found',
      tr: 'Fatura bulunamadı',
    },
  },
  RES_EXPENSE_NOT_FOUND: {
    code: 'RES_EXPENSE_NOT_FOUND',
    httpStatus: HTTP_STATUS.NOT_FOUND,
    category: ERROR_CATEGORY.RESOURCE,
    message: {
      en: 'Expense not found',
      tr: 'Gider bulunamadı',
    },
  },
  RES_USER_NOT_FOUND: {
    code: 'RES_USER_NOT_FOUND',
    httpStatus: HTTP_STATUS.NOT_FOUND,
    category: ERROR_CATEGORY.RESOURCE,
    message: {
      en: 'User not found',
      tr: 'Kullanıcı bulunamadı',
    },
  },
  RES_ALREADY_EXISTS: {
    code: 'RES_ALREADY_EXISTS',
    httpStatus: HTTP_STATUS.CONFLICT,
    category: ERROR_CATEGORY.RESOURCE,
    message: {
      en: 'A resource with this identifier already exists',
      tr: 'Bu tanımlayıcıya sahip bir kaynak zaten mevcut',
    },
  },
  RES_EMAIL_ALREADY_REGISTERED: {
    code: 'RES_EMAIL_ALREADY_REGISTERED',
    httpStatus: HTTP_STATUS.CONFLICT,
    category: ERROR_CATEGORY.RESOURCE,
    message: {
      en: 'This email address is already registered',
      tr: 'Bu e-posta adresi zaten kayıtlı',
    },
  },

  // ==========================================
  // BUSINESS LOGIC ERRORS (BUS_*)
  // ==========================================
  BUS_INVOICE_ALREADY_PAID: {
    code: 'BUS_INVOICE_ALREADY_PAID',
    httpStatus: HTTP_STATUS.CONFLICT,
    category: ERROR_CATEGORY.BUSINESS,
    message: {
      en: 'This invoice has already been marked as paid',
      tr: 'Bu fatura zaten ödendi olarak işaretlenmiş',
    },
  },
  BUS_INVOICE_CANNOT_DELETE: {
    code: 'BUS_INVOICE_CANNOT_DELETE',
    httpStatus: HTTP_STATUS.CONFLICT,
    category: ERROR_CATEGORY.BUSINESS,
    message: {
      en: 'Paid invoices cannot be deleted',
      tr: 'Ödenmiş faturalar silinemez',
    },
  },
  BUS_VAT_REGISTRATION_REQUIRED: {
    code: 'BUS_VAT_REGISTRATION_REQUIRED',
    httpStatus: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    category: ERROR_CATEGORY.BUSINESS,
    message: {
      en: 'VAT registration is required as turnover exceeds the threshold',
      tr: 'Ciro eşiği aştığı için KDV kaydı gereklidir',
    },
  },
  BUS_INSUFFICIENT_BALANCE: {
    code: 'BUS_INSUFFICIENT_BALANCE',
    httpStatus: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    category: ERROR_CATEGORY.BUSINESS,
    message: {
      en: 'Insufficient account balance',
      tr: 'Yetersiz hesap bakiyesi',
    },
  },
  BUS_TAX_RETURN_ALREADY_SUBMITTED: {
    code: 'BUS_TAX_RETURN_ALREADY_SUBMITTED',
    httpStatus: HTTP_STATUS.CONFLICT,
    category: ERROR_CATEGORY.BUSINESS,
    message: {
      en: 'Tax return has already been submitted for this period',
      tr: 'Bu dönem için vergi beyannamesi zaten gönderildi',
    },
  },

  // ==========================================
  // SYSTEM ERRORS (SYS_*)
  // ==========================================
  SYS_INTERNAL_ERROR: {
    code: 'SYS_INTERNAL_ERROR',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    category: ERROR_CATEGORY.SYSTEM,
    message: {
      en: 'An unexpected error occurred. Please try again later.',
      tr: 'Beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
    },
  },
  SYS_DATABASE_ERROR: {
    code: 'SYS_DATABASE_ERROR',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    category: ERROR_CATEGORY.SYSTEM,
    message: {
      en: 'A database error occurred. Please try again later.',
      tr: 'Veritabanı hatası oluştu. Lütfen daha sonra tekrar deneyin.',
    },
  },
  SYS_SERVICE_UNAVAILABLE: {
    code: 'SYS_SERVICE_UNAVAILABLE',
    httpStatus: HTTP_STATUS.SERVICE_UNAVAILABLE,
    category: ERROR_CATEGORY.SYSTEM,
    message: {
      en: 'Service is temporarily unavailable. Please try again later.',
      tr: 'Hizmet geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
    },
  },
  SYS_FAILED_TO_RETRIEVE_TAX_RATES: {
    code: 'SYS_FAILED_TO_RETRIEVE_TAX_RATES',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    category: ERROR_CATEGORY.SYSTEM,
    message: {
      en: 'Failed to retrieve tax rates',
      tr: 'Vergi oranları alınamadı',
    },
  },
  SYS_FAILED_TO_CALCULATE_TAX: {
    code: 'SYS_FAILED_TO_CALCULATE_TAX',
    httpStatus: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    category: ERROR_CATEGORY.SYSTEM,
    message: {
      en: 'Failed to calculate tax',
      tr: 'Vergi hesaplanamadı',
    },
  },

  // ==========================================
  // NETWORK ERRORS (NET_*)
  // ==========================================
  NET_CONNECTION_ERROR: {
    code: 'NET_CONNECTION_ERROR',
    httpStatus: HTTP_STATUS.SERVICE_UNAVAILABLE,
    category: ERROR_CATEGORY.NETWORK,
    message: {
      en: 'Unable to connect to the server. Please check your connection.',
      tr: 'Sunucuya bağlanılamıyor. Lütfen bağlantınızı kontrol edin.',
    },
  },
  NET_TIMEOUT: {
    code: 'NET_TIMEOUT',
    httpStatus: HTTP_STATUS.SERVICE_UNAVAILABLE,
    category: ERROR_CATEGORY.NETWORK,
    message: {
      en: 'Request timed out. Please try again.',
      tr: 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.',
    },
  },
  NET_OFFLINE: {
    code: 'NET_OFFLINE',
    httpStatus: HTTP_STATUS.SERVICE_UNAVAILABLE,
    category: ERROR_CATEGORY.NETWORK,
    message: {
      en: 'You appear to be offline. Please check your internet connection.',
      tr: 'Çevrimdışı görünüyorsunuz. Lütfen internet bağlantınızı kontrol edin.',
    },
  },

  // ==========================================
  // RATE LIMIT ERRORS (RATE_*)
  // ==========================================
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    httpStatus: HTTP_STATUS.TOO_MANY_REQUESTS,
    category: ERROR_CATEGORY.RATE_LIMIT,
    message: {
      en: 'Too many requests. Please wait before trying again.',
      tr: 'Çok fazla istek. Lütfen tekrar denemeden önce bekleyin.',
    },
  },
  RATE_LOGIN_ATTEMPTS_EXCEEDED: {
    code: 'RATE_LOGIN_ATTEMPTS_EXCEEDED',
    httpStatus: HTTP_STATUS.TOO_MANY_REQUESTS,
    category: ERROR_CATEGORY.RATE_LIMIT,
    message: {
      en: 'Too many login attempts. Please try again in {{minutes}} minutes.',
      tr: 'Çok fazla giriş denemesi. Lütfen {{minutes}} dakika sonra tekrar deneyin.',
    },
  },
};

/**
 * Create a standardized error response object
 * @param {string} errorCode - The error code key from ERROR_CODES
 * @param {Object} [params={}] - Parameters for message interpolation
 * @param {Object} [details=null] - Additional error details
 * @returns {Object} Standardized error object
 */
const createErrorResponse = (errorCode, params = {}, details = null) => {
  const errorDef = ERROR_CODES[errorCode];
  
  if (!errorDef) {
    console.warn(`Unknown error code: ${errorCode}`);
    return {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: {
          en: 'An unknown error occurred',
          tr: 'Bilinmeyen bir hata oluştu',
        },
      },
    };
  }

  // Interpolate parameters into messages
  const interpolateMessage = (message, params) => {
    if (!params || Object.keys(params).length === 0) return message;
    
    return Object.entries(params).reduce((msg, [key, value]) => {
      return msg.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }, message);
  };

  const response = {
    success: false,
    error: {
      code: errorDef.code,
      category: errorDef.category,
      message: {
        en: interpolateMessage(errorDef.message.en, params),
        tr: interpolateMessage(errorDef.message.tr, params),
      },
    },
  };

  if (details) {
    response.error.details = details;
  }

  return response;
};

/**
 * Get HTTP status for an error code
 * @param {string} errorCode - The error code key
 * @returns {number} HTTP status code
 */
const getHttpStatus = (errorCode) => {
  const errorDef = ERROR_CODES[errorCode];
  return errorDef ? errorDef.httpStatus : HTTP_STATUS.INTERNAL_SERVER_ERROR;
};

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(errorCode, params = {}, details = null) {
    const errorDef = ERROR_CODES[errorCode] || ERROR_CODES.SYS_INTERNAL_ERROR;
    super(errorDef.message.en);
    
    this.name = 'ApiError';
    this.code = errorDef.code;
    this.httpStatus = errorDef.httpStatus;
    this.category = errorDef.category;
    this.message = errorDef.message.en;
    this.messageTr = errorDef.message.tr;
    this.params = params;
    this.details = details;
    
    Error.captureStackTrace(this, ApiError);
  }

  /**
   * Convert to response object
   * @returns {Object} API response object
   */
  toResponse() {
    return createErrorResponse(this.code, this.params, this.details);
  }
}

/**
 * Get all error codes for a specific category
 * @param {string} category - Error category
 * @returns {Object} Error codes matching the category
 */
const getErrorsByCategory = (category) => {
  return Object.entries(ERROR_CODES)
    .filter(([, def]) => def.category === category)
    .reduce((acc, [key, def]) => {
      acc[key] = def;
      return acc;
    }, {});
};

/**
 * Check if an error code exists
 * @param {string} errorCode - Error code to check
 * @returns {boolean}
 */
const isValidErrorCode = (errorCode) => {
  return errorCode in ERROR_CODES;
};

module.exports = {
  HTTP_STATUS,
  ERROR_CATEGORY,
  ERROR_CODES,
  createErrorResponse,
  getHttpStatus,
  ApiError,
  getErrorsByCategory,
  isValidErrorCode,
};
