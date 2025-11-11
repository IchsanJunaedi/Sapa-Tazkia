const { generateGeminiResponse, testGeminiConnection } = require('../services/geminiService');

const testAI = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    console.log('🔍 AI Test Request:', message);

    const aiResponse = await generateGeminiResponse(message);

    res.json({
      success: true,
      message: "AI test successful",
      input: message,
      response: aiResponse
    });

  } catch (error) {
    console.error('❌ AI Test Error:', error);
    res.status(500).json({
      success: false,
      message: "AI service error",
      error: error.message
    });
  }
};

const testGeminiConnectionHandler = async (req, res) => {
  try {
    const result = await testGeminiConnection();
    
    if (result.success) {
      res.json({
        success: true,
        message: "Gemini connection test successful",
        response: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Gemini connection test failed",
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('❌ Gemini Connection Test Error:', error);
    res.status(500).json({
      success: false,
      message: "Gemini connection test error",
      error: error.message
    });
  }
};

module.exports = {
  testAI,
  testGeminiConnection: testGeminiConnectionHandler
};