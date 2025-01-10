import * as nodemailer from 'nodemailer';

async function sendTestEmail() {
  const transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
      user: 'ptoptimasitbk@outlook.com',
      pass: 'surabayaAB12!@',
    },
  });

  const mailOptions = {
    from: 'ptoptimasitbk@outlook.com',
    to: 'farihulrouf@gmail.com',
    subject: 'Test Email',
    text: 'This is a test email.',
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Test email sent');
  } catch (error) {
    console.error('Error sending test email:', error);
  }
}

sendTestEmail();
