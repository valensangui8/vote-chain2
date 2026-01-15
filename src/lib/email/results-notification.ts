import * as brevo from '@getbrevo/brevo';

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY || '');

export interface ResultsNotificationEmailProps {
    voterEmail: string;
    electionName: string;
    electionId: string;
    resultsUrl?: string;
}

export async function sendResultsNotificationEmail({
    voterEmail,
    electionName,
    electionId,
    resultsUrl,
}: ResultsNotificationEmailProps) {
    const finalResultsUrl = resultsUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'https://vote-chain2.netlify.app'}/results/${electionId}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Results Available</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                📊 Results Are Now Available!
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              
              <p style="margin: 0 0 24px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Hi there,
              </p>

              <p style="margin: 0 0 32px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                The results for <strong>"${electionName}"</strong> are now available to view.
              </p>

              <!-- Results Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ecfdf5; border-radius: 8px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <h2 style="margin: 0 0 16px 0; color: #065f46; font-size: 18px; font-weight: 600;">
                      📋 ${electionName}
                    </h2>
                    <p style="margin: 0 0 20px 0; color: #047857; font-size: 14px;">
                      All votes have been counted and verified on the blockchain.
                    </p>
                    <a href="${finalResultsUrl}" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      📊 View Results
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Thank You Note -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; text-align: center;">
                      <strong>Thank you for participating!</strong><br>
                      Your vote helped make this election secure, transparent, and anonymous.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Info Note -->
              <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
                🔒 Your vote remains encrypted and anonymous. The results show the final tally without revealing individual votes.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                Powered by <strong>VoteChain</strong> - Secure Blockchain Voting
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

    try {
        const sendSmtpEmail = new brevo.SendSmtpEmail();

        const senderEmail = process.env.BREVO_SENDER_EMAIL || 'valentinosanguinetti@gmail.com';

        sendSmtpEmail.sender = {
            name: 'VoteChain',
            email: senderEmail
        };
        sendSmtpEmail.to = [{ email: voterEmail }];
        sendSmtpEmail.subject = `📊 Results Available - ${electionName}`;
        sendSmtpEmail.htmlContent = htmlContent;

        const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

        return { success: true, data: result };
    } catch (error) {
        console.error('Failed to send results notification email:', error);
        return { success: false, error };
    }
}
