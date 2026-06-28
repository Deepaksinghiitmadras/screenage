import nodemailer from 'nodemailer';
import {WELCOME_EMAIL_TEMPLATE, NEWS_SUMMARY_EMAIL_TEMPLATE} from "@/lib/nodemailer/templates";

// Verify transporter configuration
if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
    console.warn('⚠️ NODEMAILER_EMAIL or NODEMAILER_PASSWORD is not set. Email functionality will not work.');
}

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL!,
        pass: process.env.NODEMAILER_PASSWORD!,
    },
    // Add connection timeout and retry options
    pool: true,
    maxConnections: 1,
    maxMessages: 3,
})

// Verify connection on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Nodemailer transporter verification failed:', error);
    } else {
        console.log('✅ Nodemailer transporter is ready to send emails');
    }
});

export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
    try {
        if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
            throw new Error('Email credentials not configured');
        }

        const htmlTemplate = WELCOME_EMAIL_TEMPLATE
            .replace('{{name}}', name)
            .replace('{{intro}}', intro);

        const mailOptions = {
            from: `"Screenage" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: `Welcome to Screenage - your stock market toolkit!`,
            text: 'Thanks for joining Screenage',
            html: htmlTemplate,
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Welcome email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Failed to send welcome email:', error);
        throw error;
    }
}

export const sendNewsSummaryEmail = async (
    { email, date, newsContent }: { email: string; date: string; newsContent: string }
) => {
    try {
        if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
            throw new Error('Email credentials not configured');
        }

        const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE
            .replace('{{date}}', date)
            .replace('{{newsContent}}', newsContent);

        const mailOptions = {
            from: `"Screenage" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: `📈 Market News Summary Today - ${date}`,
            text: `Today's market news summary from Screenage`,
            html: htmlTemplate,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ News summary email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('❌ Failed to send news summary email:', error);
        throw error;
    }
};