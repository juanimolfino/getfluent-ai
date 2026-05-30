import * as React from "react";

export function WelcomeEmail({ credits }: { credits: number }) {
  return (
    <html>
      <body>
        <h1>Welcome</h1>
        <p>Your account is ready and includes {credits} free credits.</p>
      </body>
    </html>
  );
}
