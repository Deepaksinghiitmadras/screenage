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

/** Shared dark-theme email shell. */
function emailShell(title: string, bodyHtml: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#0b0f14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f14;padding:24px;"><tr><td align="center">
    <div style="max-width:600px;width:100%;border:1px solid #1f2937;border-radius:12px;background:#111827;padding:28px;">
    <h2 style="margin:0 0 4px;font-size:22px;color:#fff;"><span style="color:#0FEDBE;">📊</span> Screenage</h2>
    <h1 style="margin:8px 0 18px;font-size:20px;color:#fff;">${title}</h1>
    ${bodyHtml}
    <p style="margin-top:24px;font-size:11px;color:#6b7280;border-top:1px solid #1f2937;padding-top:14px;">Delayed data · research/education only, not investment advice. You can change email preferences in your account.</p>
    </div></td></tr></table></body></html>`;
}

export const sendAlertEmail = async (
    { email, name, symbol, headline, detail }: { email: string; name: string; symbol: string; headline: string; detail: string }
) => {
    if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
        throw new Error('Email credentials not configured');
    }
    const body = `
        <p style="color:#9ca3af;font-size:14px;margin:0 0 16px;">Hi ${name}, an alert you set has triggered:</p>
        <div style="background:#0b0f14;border:1px solid #1f2937;border-radius:8px;padding:16px;">
            <div style="font-size:18px;font-weight:700;color:#0FEDBE;">${symbol}</div>
            <div style="font-size:15px;color:#fff;margin-top:4px;">${headline}</div>
            <div style="font-size:13px;color:#9ca3af;margin-top:6px;">${detail}</div>
        </div>`;
    const mailOptions = {
        from: `"Screenage Alerts" <${process.env.NODEMAILER_EMAIL}>`,
        to: email,
        subject: `🔔 ${symbol} alert: ${headline}`,
        text: `${symbol}: ${headline}. ${detail}`,
        html: emailShell('Price Alert Triggered', body),
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Alert email sent:', info.messageId);
    return info;
};

export const sendDailyDigestEmail = async (
    { email, name, date, contentHtml }: { email: string; name: string; date: string; contentHtml: string }
) => {
    if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
        throw new Error('Email credentials not configured');
    }
    const body = `<p style="color:#9ca3af;font-size:14px;margin:0 0 16px;">Good morning ${name} — here's your market brief for ${date}.</p>${contentHtml}`;
    const mailOptions = {
        from: `"Screenage" <${process.env.NODEMAILER_EMAIL}>`,
        to: email,
        subject: `☀️ Your morning market brief — ${date}`,
        text: `Your Screenage morning brief for ${date}`,
        html: emailShell('Morning Market Brief', body),
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Daily digest email sent:', info.messageId);
    return info;
};