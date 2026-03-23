// Mock pdf-parse untuk test environment
// Mencegah @napi-rs/canvas native binding load saat test
module.exports = jest.fn().mockResolvedValue({
  text: 'mock pdf content',
  numpages: 1,
  info: {},
  metadata: {},
});
