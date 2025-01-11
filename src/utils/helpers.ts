import axios from 'axios';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

export const DATABASE_POST = 'http://localhost:3000/posts';


export async function saveImage(imageUrl: string, filename: string): Promise<void> {
    try {
      if (!fs.existsSync('images')) {
        fs.mkdirSync('images');
      }
  
      const cleanedFilename = filename.replace(/[<>:"/\\|?*]+/g, '_');
      const finalFilename = `${cleanedFilename}.jpg`;
      const filePath = `images/${finalFilename}`;
  
      const response = await axios.get(imageUrl, { responseType: 'stream' });
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
  
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
  
      console.log(`[INFO] Image saved: ${filePath}`);
    } catch (error) {
      console.error(`[ERROR] Failed to save image: ${imageUrl}`, error.message);
    }
  }
  

// Fungsi untuk mengirimkan email
export async function sendEmail(subject: string, text: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_RECEIVER,
    subject: subject,
    text: text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('[INFO] Email sent successfully.');
  } catch (error) {
    console.error('[ERROR] Failed to send email:', error);
  }
}

// Fungsi untuk mengirimkan pesan ke Telegram Channel
export async function sendToTelegramChannel(message: string): Promise<void> {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const telegramApiUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;

  try {
    const response = await axios.post(telegramApiUrl, {
      chat_id: telegramChatId,
      text: message,
      parse_mode: 'Markdown',
    });
    console.log(`[INFO] Telegram message sent: ${response.data.ok}`);
  } catch (error) {
    console.error(`[ERROR] Failed to send Telegram message:`, error.response?.data || error.message);
  }
}

// Fungsi untuk mengirimkan data ke database PostgreSQL
export async function sendTodbPostgre(data: any): Promise<void> {
  try {
    console.log(`[DEBUG] Sending data to database: ${JSON.stringify(data)}`);
    await axios.post(DATABASE_POST, data, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('[INFO] Data sent to database successfully.');
  } catch (error) {
    console.error('[ERROR] Failed to send data to database:', error.response?.data || error.message);
  }
}
