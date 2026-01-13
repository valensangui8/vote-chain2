import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface VoteConfirmationEmailProps {
  voterEmail: string;
  electionName: string;
  transactionHash: string;
  timestamp: string;
  electionId: string;
}

export async function sendVoteConfirmationEmail({
  voterEmail,
  electionName,
  transactionHash,
  timestamp,
  electionId,
}: VoteConfirmationEmailProps) {
  const etherscanUrl = `https://sepolia.etherscan.io/tx/${transactionHash}`;
  const resultsUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://vote-chain2.netlify.app'}/results/${electionId}`;

  const shortHash = `${transactionHash.slice(0, 10)}...${transactionHash.slice(-8)}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vote Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                ✅ Vote Successfully Recorded!
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
                Your vote in <strong>"${electionName}"</strong> has been successfully recorded on the Ethereum blockchain.
              </p>

              <!-- Election Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                      📋 Election Details
                    </h2>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Election:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500; text-align: right;">${electionName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Voted at:</td>
                        <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500; text-align: right;">${timestamp}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Transaction Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <h2 style="margin: 0 0 16px 0; color: #1e40af; font-size: 18px; font-weight: 600;">
                      🔐 Transaction Details
                    </h2>
                    <p style="margin: 0 0 12px 0; color: #1f2937; font-size: 14px;">
                      <strong>Transaction Hash:</strong>
                    </p>
                    <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 13px; font-family: 'Courier New', monospace; word-break: break-all;">
                      ${shortHash}
                    </p>
                    <a href="${etherscanUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600;">
                      🔍 Verify on Etherscan →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Privacy Note -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                      <strong>🔒 Privacy Note:</strong> Your vote choice is encrypted and anonymous. This receipt only confirms that you participated - it does not reveal who you voted for.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Results Link -->
              <p style="margin: 0 0 16px 0; color: #374151; font-size: 14px; line-height: 1.6;">
                📊 Results will be available after the election ends.
              </p>
              <a href="${resultsUrl}" style="display: inline-block; color: #6366f1; text-decoration: none; font-size: 14px; font-weight: 600;">
                View Election →
              </a>

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
    const { data, error } = await resend.emails.send({
      from: 'VoteChain <noreply@resend.dev>', // You'll need to update this with your verified domain
      to: [voterEmail],
      subject: `✅ Your Vote Has Been Recorded - ${electionName}`,
      html: htmlContent,
    });

    if (error) {
      console.error('Error sending vote confirmation email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Failed to send vote confirmation email:', error);
    return { success: false, error };
  }
}
