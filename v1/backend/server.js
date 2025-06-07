import express from "express";
import cors from "cors";
import "dotenv/config";

import textToSpeechRouter from "./api/routes/textToSpeechRouter.js"
import speechToTextRouter from "./api/routes/speechToTextRouter.js";
import speechToSpeechRouter from "./api/routes/speechToSpeechRouter.js";
import textToTextRouter from "./api/routes/textToTextRouter.js";
import connectDB from "./api/config/db.js";
import feedbackRouter from "./api/routes/feedbackRouter.js";

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("Hello, this is the API for OdishaVox!");
});

app.use('/api/v1/tts', textToSpeechRouter);
app.use('/api/v1/stt', speechToTextRouter);
app.use('/api/v1/sts', speechToSpeechRouter);
app.use('/api/v1/ttt', textToTextRouter);
app.use('/api/v1/feedback', feedbackRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

const conn = connectDB();