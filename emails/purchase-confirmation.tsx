import * as React from "react";

export function PurchaseConfirmationEmail({ credits }: { credits: number }) {
  return (
    <html>
      <body>
        <h1>Credits added</h1>
        <p>{credits} credits were added to your account.</p>
      </body>
    </html>
  );
}
