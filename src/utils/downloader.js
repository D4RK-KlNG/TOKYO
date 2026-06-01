/**
 * Download image from URL helper
 */

const axios = require('axios');

module.exports = {

    fetchImage: async (url) => {
        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'arraybuffer',
                timeout: 30000
            });
            return Buffer.from(response.data, 'binary');
        } catch (error) {
            throw new Error(`Failed to download image: ${error.message}`);
        }
    }
};
