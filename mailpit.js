import { MailpitClient } from "mailpit-api";

export function MailpitClientStarter(URL){
    const client = new MailpitClient(URL);
        if (client!=null)
            return client
        console.log("error connecting to mailpit")
        return null
}

export  async function sendEmail(client,to, from, subject,text ) {
  client.sendMessage({
  From: { Email: from || "tecdigitalito@info.ac.cr"},
  To: [{ Email: to||"user@example.test" }],
  Subject: subject,
  Text: text,
});

  // En desarrollo, mostrar en la terminal cualquier link presente en el correo
  // (útil para testing sin necesidad de acceder a Mailpit/correo real)
  // Se puede borrar después, es mas que nada para testing
  const linkMatch = text.match(/http[s]?:\/\/[^\s]+/);
  if (linkMatch) {
    console.log(`\nEmail sent to ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Link: ${linkMatch[0]}\n`);
  }
}
