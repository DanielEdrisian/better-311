const express = require("express");
const axios = require("axios");
const exifParser = require("exif-parser");
// const sharp = require("sharp");
const { findEXIFinHEIC } = require("./exif-heic");
const { systemMessage } = require("./systemMessage");
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: "",
});
const Replicate = require("replicate");
const replicate = new Replicate({
  auth: "",
});

const app = express();
const port = 3000;

// Body parser
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

async function fetchImageAndExtractExifJPEG(url) {
  try {
    // Fetch the image from the CDN URL
    const response = await axios.get(url, { responseType: "arraybuffer" });

    // Ensure the response is valid
    if (response.data) {
      const parser = exifParser.create(response.data);
      const result = parser.parse();

      console.log(result);

      // If you want to extract specific data, e.g., camera make:
      console.log("Camera Make:", result.tags.Make);
    } else {
      console.log("Failed to retrieve the image or EXIF data.");
    }
  } catch (error) {
    console.error("Error fetching image or parsing EXIF:", error.message);
  }
}

async function fetchImageAndExtractExifHEIC(url) {
  try {
    // Fetch the image from the CDN URL
    const response = await axios.get(url, { responseType: "arraybuffer" });

    // Ensure the response is valid
    if (response.data) {
      console.log(response.data);
      // type
      console.log(typeof response.data);
      const tags = findEXIFinHEIC(response.data.buffer);

      console.log(tags);

      // If you want to extract specific data, e.g., camera make:
      console.log("Camera Make:", tags.Make);
    } else {
      console.log("Failed to retrieve the image or EXIF data.");
    }
  } catch (error) {
    console.error("Error fetching image or parsing EXIF:", error.message);
  }
}

const telnyx = require("telnyx")(
  ""
);

async function handleMessage(fromPhone) {
  const functions = [
    {
      name: "send_311_report",
      description: "Sends the report to 311",
      parameters: {
        type: "object",
        properties: {
          report_data: {
            type: "string",
            description: "JSON string containing the report data",
          },
        },
        required: ["report_data"],
      },
    },
    {
      name: "get_building_code_info",
      description: "Searches the building code",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "the query for desired building code information",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "request_location",
      description: "Request the user's location",
      parameters: {
        type: "object",
        properties: {
          precision: {
            type: "string",
            description: "Precision requested for location",
          },
        },
        required: ["precision"],
      },
    },
  ];

  const messageHistory = history[fromPhone] || [];

  let aiMessages = [
    { role: "system", content: systemMessage },
    ...messageHistory,
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4-32k",
    messages: aiMessages,
    temperature: 0.75,
    max_tokens: 1500,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0.0,
    functions: functions,
    function_call: "auto",
  });

  let responseText;
  if (response.choices[0].message.function_call) {
    const name = response.choices[0].message.function_call.name;
    if (name == "send_311_report") {
    }
    if (name == "request_location") {
      responseText =
        "Please share your location with us by clicking this link: https://aae9-107-3-134-29.ngrok-free.app/location_request?chatId=" +
        fromPhone;
    }
  } else {
    responseText = response.choices[0].message.content;
  }

  aiMessages.push({ role: "assistant", content: responseText });
  history[fromPhone] = aiMessages.slice(1);

  await telnyx.messages.create({
    from: "+14159938355", // Your Telnyx number
    to: fromPhone, // Your mobile phone number
    text: responseText,
  });

}

app.post("/telnyx", async (req, res) => {
  console.log(req.body.data.payload.text);
  console.log(req.body.data.payload);
  const fromPhone = req.body.data.payload.from.phone_number;

  if (req.body.data.payload.direction == "outbound") {
    res.send({ message: "Thanks for sending your location!" });
    return;
  }
  const messageHistory = history[fromPhone] || [];

  if (req.body.data.payload.media.length > 0) {
    const imageURL = req.body.data.payload.media[0].url;
    const prompt =
      `Select which category this image represents best.

      Street Conditions: Holiday Tree Removal
      Parking & Transportation: Abandoned Vehicles
      Street Conditions: Street or Sidewalk Cleaning
      Street Conditions: Garbage Containers
      Street Conditions: Graffiti
      Parking & Transportation: Blocked Driveway & Illegal Parking
      Street Conditions: Illegal Postings
      Parking & Transportation: Muni Employee Feedback
      Street Conditions: Blocked Pedestrian Walkway
      Parking & Transportation: Muni Service Feedback
      Repair: Curb & Sidewalk Issues
      Street Conditions: Encampment
      Repair: Damaged Public Property
      Storm Conditions: Flooding, Sewer & Water Leak Issues
      General: Shared Spaces
      General: Noise Issue
      Storm Conditions: Park Requests
      Repair: Parking & Traffic Sign Repair
      Repair: Pothole & Street Issues
      Storm Conditions: Streetlight Repair
      Storm Conditions: Tree Maintenance
      
      First, select which category this image represents best.
      Then, provide a 2-3 sentence description of what's happening in the image.`;
    const output = await replicate.run(
      "yorickvp/llava-13b:2facb4a474a0462c15041b78b1ad70952ea46b5ec6ad29583c0b29dbd4249591",
      {
        input: {
          image: imageURL,
          prompt: prompt,
        },
      }
    );
    console.log(output);

    messageHistory.push({
      role: "system",
      content: `User sent an image: ${output.join("")}`,
    });
  }

  if (req.body.data.payload.text) {
    messageHistory.push({ role: "user", content: req.body.data.payload.text });
  }

  history[fromPhone] = messageHistory;

  await handleMessage(fromPhone);

  // await telnyx.messages.create({
  //     'from': '+14159938355', // Your Telnyx number
  //     'to': '+19168041935', // Your mobile phone number
  //     media_urls: ['https://file-examples.com/storage/fe1734aff46541d35a76822/2017/11/file_example_MP3_700KB.mp3']
  // });

  res.send({ message: "Thanks for sending your location!" });
});

let history = {};

const twilio = require("twilio");
const { getLoc } = require("./geo-util");

const ACCOUNT_SID = "";
const AUTH_TOKEN = "";
const FROM_NUMBER = "+18085635039";
// const TO_NUMBER = '+19168041935';

const client = new twilio(ACCOUNT_SID, AUTH_TOKEN);

app.use(express.urlencoded({ extended: true }));

app.post("/sms", async (req, res) => {
  // const twiml = new twilio.twiml.MessagingResponse();

  // This can be any custom response or none at all if you just want to receive the SMS
  // twiml.message('Thanks for the message!');

  await client.messages.create({
    body: "Hello from Node!",
    to: req.body.From, // Replace with your phone number
    from: FROM_NUMBER, // Replace with your Twilio number
  });

  res.send();

  // res.writeHead(200, { "Content-Type": "text/xml" });
  // res.end(twiml.toString());
});

app.post("/sendblue_webhook", async (req, res) => {
  console.log(req.body);

  const messageHistory = history[req.body.number] || [];

  let aiMessages = [{ role: "system", content: systemMessage }];
  for (message in messageHistory) {
    if (message.username == "user" && message.content) {
      aiMessages.push({ role: "user", content: message.content });
    } else {
      aiMessages.push({ role: "system", content: message.content });
    }
  }

  const functions = [
    {
      name: "send_311_report",
      description: "Sends the report to 311",
      parameters: {
        type: "object",
        properties: {
          report_data: {
            type: "string",
            description: "JSON string containing the report data",
          },
        },
        required: ["report_data"],
      },
    },
    {
      name: "get_building_code_info",
      description: "Searches the building code",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "the query for desired building code information",
          },
        },
        required: ["query"],
      },
    },
  ];

  aiMessages.push({ role: "user", content: req.body.content });

  const response = await openai.chat.completions.create({
    model: "gpt-4-32k",
    messages: aiMessages,
    temperature: 0.75,
    max_tokens: 1500,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0.0,
    functions: functions,
    function_call: "auto",
  });

  const responseText = response.data.choices[0].text;

  const url = `https://api.sendblue.co/api/send-message`;

  aiMessages.push({ role: "assistant", content: responseText });
  history[req.body.number] = aiMessages;

  // if (
  //   req.body.media_url &&
  //   (req.body.media_url.includes(".HEIC") ||
  //     req.body.media_url.includes(".heic"))
  // ) {
  //   await fetchImageAndExtractExifHEIC(req.body.media_url);
  // } else if (
  //   req.body.media_url &&
  //   (req.body.media_url.includes(".JPG") ||
  //     req.body.media_url.includes(".jpg") ||
  //     req.body.media_url.includes(".JPEG") ||
  //     req.body.media_url.includes(".jpeg"))
  // ) {
  //   await fetchImageAndExtractExifJPEG(req.body.media_url);
  // }

  await axios.post(
    url,
    {
      number: req.body.number,
      content: responseText,
    },
    {
      headers: {
        "sb-api-key-id": "",
        "sb-api-secret-key": "",
        "content-type": "application/json",
      },
    }
  );

  res.send("Hello World!");
});

app.get("/location_request", async (req, res) => {
  const { chatId } = req.query;
  // Return html
  res.send(`
  <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Location Request</title>
    <script>
        function getLocation() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(showPosition, showError);
            } else {
                document.getElementById("message").innerHTML = "Geolocation is not supported by this browser.";
            }
        }

        function showPosition(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            // Send data to the server
            fetch('https://aae9-107-3-134-29.ngrok-free.app/got_location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chatId: '${chatId}',
                    latitude: lat,
                    longitude: lon
                })
            })
            .then(response => response.json())
            .then(data => {
                document.getElementById("message").innerHTML = "Thanks! We've received your location. You can return to your chat.";
            })
            .catch((error) => {
                console.error('Error:', error);
                document.getElementById("message").innerHTML = "An error occurred while sending the data.";
            });
        }

        function showError(error) {
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    document.getElementById("message").innerHTML = "User denied the request for Geolocation.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    document.getElementById("message").innerHTML = "Location information is unavailable.";
                    break;
                case error.TIMEOUT:
                    document.getElementById("message").innerHTML = "The request to get user location timed out.";
                    break;
                case error.UNKNOWN_ERROR:
                    document.getElementById("message").innerHTML = "An unknown error occurred.";
                    break;
            }
        }

        window.onload = getLocation;
    </script>
</head>
<body>
    <p id="message">Requesting your location...</p>
</body>
</html>
  `);
});

app.post("/got_location", async (req, res) => {
  console.log(req.body);
  const { chatId, latitude, longitude } = req.body;

  const location = await getLoc({ lat: latitude, lng: longitude });

  const messageHistory = history[chatId] || [];

  history[chatId] = [
    ...messageHistory,
    { role: "system", content: `User Location: ${location}` },
  ];

  await handleMessage(fromPhone);

  res.send({ message: "Thanks for sending your location!" });
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
