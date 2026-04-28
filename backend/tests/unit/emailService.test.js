// backend/tests/unit/emailService.test.js
//
// Unit tests for emailService — fully mocks nodemailer.
// Covers: sendEmail (success + validation + error codes),
// sendVerificationEmail (validation + delegation),
// sendWelcomeEmail / sendPasswordResetEmail / testEmailConnection,
// generateVerificationEmailHTML / generateVerificationEmailText (snapshot-ish).

jest.mock('nodemailer', () => {
  const sendMail = jest.fn();
  const verify = jest.fn();
  return {
    __sendMail: sendMail,
    __verify: verify,
    createTransport: jest.fn(() => ({ sendMail, verify })),
  };
});

const nodemailer = require('nodemailer');
const sendMailMock = nodemailer.__sendMail;
const verifyMock = nodemailer.__verify;
const emailService = require('../../src/services/emailService');

beforeEach(() => {
  sendMailMock.mockReset();
  verifyMock.mockReset();
});

describe('emailService.sendEmail', () => {
  it('returns success on transporter.sendMail success', async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: 'abc123' });
    const r = await emailService.sendEmail('a@b.com', 'subj', '<p>hi</p>');
    expect(r.success).toBe(true);
    expect(r.messageId).toBe('abc123');
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@b.com',
      subject: 'subj',
      html: '<p>hi</p>',
    }));
  });

  it('throws when required field missing', async () => {
    await expect(emailService.sendEmail()).rejects.toThrow();
    await expect(emailService.sendEmail('a@b.com')).rejects.toThrow();
    await expect(emailService.sendEmail('a@b.com', 's')).rejects.toThrow();
  });

  it('throws friendly auth-error for EAUTH', async () => {
    sendMailMock.mockRejectedValueOnce(Object.assign(new Error('bad creds'), { code: 'EAUTH' }));
    await expect(emailService.sendEmail('a@b.com', 's', '<p>x</p>')).rejects.toThrow(/Konfigurasi email/);
  });

  it('throws envelope error for EENVELOPE', async () => {
    sendMailMock.mockRejectedValueOnce(Object.assign(new Error('bad addr'), { code: 'EENVELOPE' }));
    await expect(emailService.sendEmail('a@b.com', 's', '<p>x</p>')).rejects.toThrow(/Alamat email tidak valid/);
  });

  it('throws connection error for ECONNECTION', async () => {
    sendMailMock.mockRejectedValueOnce(Object.assign(new Error('no conn'), { code: 'ECONNECTION' }));
    await expect(emailService.sendEmail('a@b.com', 's', '<p>x</p>')).rejects.toThrow(/server email/);
  });

  it('throws generic error for unrecognized code', async () => {
    sendMailMock.mockRejectedValueOnce(Object.assign(new Error('weird'), { code: 'EWHATEVER' }));
    await expect(emailService.sendEmail('a@b.com', 's', '<p>x</p>')).rejects.toThrow(/Gagal mengirim email/);
  });
});

describe('emailService.sendVerificationEmail', () => {
  it('throws when input missing', async () => {
    await expect(emailService.sendVerificationEmail()).rejects.toThrow();
    await expect(emailService.sendVerificationEmail('a@b.com')).rejects.toThrow();
  });

  it('throws when code length is wrong', async () => {
    await expect(emailService.sendVerificationEmail('a@b.com', '12')).rejects.toThrow(/6 digit/);
  });

  it('delegates to transporter when input valid', async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: 'm1' });
    const r = await emailService.sendVerificationEmail('a@b.com', '123456', 'Budi');
    expect(r.success).toBe(true);
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@b.com',
      subject: expect.stringContaining('Verifikasi'),
    }));
  });
});

describe('emailService.sendWelcomeEmail', () => {
  it('sends a welcome email with student wording by default', async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: 'wm1' });
    const r = await emailService.sendWelcomeEmail('a@b.com', 'Budi');
    expect(r.success).toBe(true);
  });

  it('supports admin user type', async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: 'wm2' });
    const r = await emailService.sendWelcomeEmail('a@b.com', 'Admin', 'admin');
    expect(r.success).toBe(true);
  });
});

describe('emailService.sendPasswordResetEmail', () => {
  it('returns true on success', async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: 'r1' });
    const r = await emailService.sendPasswordResetEmail('a@b.com', 'https://example.com/reset?token=x');
    expect(r).toBe(true);
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
      subject: expect.stringContaining('Reset'),
    }));
  });
});

describe('emailService.testEmailConnection', () => {
  it('returns success when verify resolves', async () => {
    verifyMock.mockResolvedValueOnce(true);
    const r = await emailService.testEmailConnection();
    expect(r.success).toBe(true);
  });

  it('returns failure when verify rejects', async () => {
    verifyMock.mockRejectedValueOnce(new Error('SMTP down'));
    const r = await emailService.testEmailConnection();
    expect(r.success).toBe(false);
    expect(r.details).toContain('SMTP');
  });
});

describe('emailService template helpers', () => {
  it('generateVerificationEmailHTML embeds code + name', () => {
    const html = emailService.generateVerificationEmailHTML('Budi', '987654');
    expect(html).toContain('Budi');
    expect(html).toContain('987654');
  });

  it('generateVerificationEmailText embeds code + name', () => {
    const text = emailService.generateVerificationEmailText('Budi', '987654');
    expect(text).toContain('Budi');
    expect(text).toContain('987654');
  });
});
