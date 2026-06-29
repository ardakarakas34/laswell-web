'use strict';

/**
 * LASWELL — Admin & E-posta Ayarları
 * -----------------------------------
 * E-posta onay kodu için EmailJS hesabı oluşturun: https://www.emailjs.com
 * 1. Email Service ekleyin (Gmail, Outlook vb.)
 * 2. Email Template oluşturun — şablon içinde {{passcode}} kullanın
 * 3. Aşağıdaki değerleri doldurun
 */
const LASWELL_CONFIG = {
  // Onay kodunun gönderileceği admin e-posta adresi
  adminEmail: 'info@laswell.com',

  emailjs: {
    publicKey:  'YOUR_PUBLIC_KEY',
    serviceId:  'YOUR_SERVICE_ID',
    templateId: 'YOUR_TEMPLATE_ID',
  },

  otpExpiryMinutes: 10,
  maxOtpAttempts:   5,
};
