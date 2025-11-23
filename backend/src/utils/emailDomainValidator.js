// // utils/emailDomainValidator.js

// /**
//  * Utility untuk validasi domain email yang diizinkan
//  */

// const ALLOWED_DOMAINS = [
//   'student.tazkia.ac.id',
//   'student.stmik.tazkia.ac.id', 
//   'tazkia.ac.id',
//   'stmik.tazkia.ac.id'
// ];

// /**
//  * Validasi apakah email dari domain yang diizinkan
//  */
// const isValidDomain = (email) => {
//   if (!email || typeof email !== 'string') {
//     return false;
//   }

//   const emailParts = email.split('@');
//   if (emailParts.length !== 2) {
//     return false;
//   }

//   const domain = emailParts[1].toLowerCase();
//   return ALLOWED_DOMAINS.includes(domain);
// };

// /**
//  * Get list domain yang diizinkan (untuk tampilan error message)
//  */
// const getAllowedDomains = () => {
//   return ALLOWED_DOMAINS;
// };

// /**
//  * Get domain type (student/staff) dari email
//  */
// const getDomainType = (email) => {
//   if (!isValidDomain(email)) {
//     return 'invalid';
//   }

//   const domain = email.split('@')[1].toLowerCase();
  
//   if (domain.includes('student.')) {
//     return 'student';
//   } else {
//     return 'staff';
//   }
// };

// /**
//  * Extract NIM dari email student
//  */
// const extractNIMFromEmail = (email) => {
//   if (!isValidDomain(email) || getDomainType(email) !== 'student') {
//     return null;
//   }

//   // Pattern: 241572010024.ichsan@student.stmik.tazkia.ac.id
//   const localPart = email.split('@')[0];
//   const nimMatch = localPart.match(/^(\d+)/);
  
//   return nimMatch ? nimMatch[1] : null;
// };

// module.exports = {
//   isValidDomain,
//   getAllowedDomains,
//   getDomainType,
//   extractNIMFromEmail
// };