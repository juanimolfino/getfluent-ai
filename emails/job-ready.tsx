import * as React from "react";

export function JobReadyEmail({ resultUrl }: { resultUrl: string }) {
  return (
    <html>
      <body>
        <h1>Your AI job is ready</h1>
        <p>
          Open your result here: <a href={resultUrl}>{resultUrl}</a>
        </p>
      </body>
    </html>
  );
}
