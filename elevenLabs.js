const axios = require('axios');
const fs = require('fs-extra');
const FormData = require('form-data');

const voice = require('elevenlabs-node');

const apiKey = '';
const voiceID = '4VdIvfguz4gfq2ADAVVa';
const fileName = 'audio.mp3';
const textInput = 'GeneratedByPrompt';
const londBreedLLMPrompt = 'Write a brief and empathetic message in the style of a mayor addressing a resident who reported an issue. The message should convey sympathy and the importance of reporting the issue. The message should end with an assurance of prompt action to fix the situation.';
const endpoint = 'https://better311.com/'; 

voice.textToSpeech(apiKey, voiceID, fileName, textInput)
  .then((res) => {
    console.log('Audio file created:', res);

    const fileStream = fs.createReadStream(fileName);

    const formData = new FormData();
    formData.append('file', fileStream);

    axios.post(endpoint, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': 'Bearer your-token', // If authorization is required
      },
    })
    .then((response) => {
      console.log('File sent successfully:', response.data);
    })
    .catch((error) => {
      console.error('Error sending the file:', error);
    });
  })
  .catch((error) => {
    console.error('Error creating audio file:', error);
  });