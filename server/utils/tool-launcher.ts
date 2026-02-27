export const renderLti11AutoPost = (url: string, signedParams: Record<string, string>) => {
  const inputs = Object.entries(signedParams)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`)
    .join('\n');

  return `
    <!DOCTYPE html>
    <html>
      <head><title>Loading Tool...</title></head>
      <body onload="document.forms[0].submit()">
        <form action="${url}" method="POST">
          ${inputs}
        </form>
        <div style="text-align:center; margin-top:50px;">
          <p>Redirecting you to the external tool...</p>
        </div>
      </body>
    </html>
  `;
};