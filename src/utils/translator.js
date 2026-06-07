const axios = require("axios");

/**
 * Translates text using the free Google Translate API.
 * 
 * @param {string} text - The text to be translated
 * @param {string} sourceLang - Source language code (e.g., 'id', 'en')
 * @param {string} targetLang - Target language code (e.g., 'en', 'id')
 * @returns {Promise<string>} The translated text
 */
async function translateText(text, sourceLang, targetLang) {
  try {
    if (!text || text.trim() === "" || text === "-") {
      return "-";
    }

    const url = "https://translate.googleapis.com/translate_a/single";
    const response = await axios.get(url, {
      params: {
        client: "gtx",
        sl: sourceLang,
        tl: targetLang,
        dt: "t",
        q: text,
      },
    });

    if (response.data && response.data[0]) {
      const translated = response.data[0]
        .map((sentence) => sentence[0])
        .join("");
      return translated;
    }

    return text;
  } catch (error) {
    console.error(`Translation error from ${sourceLang} to ${targetLang}:`, error.message);
    return text; // Fallback to original text on failure
  }
}

module.exports = { translateText };
