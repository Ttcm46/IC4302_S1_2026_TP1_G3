import { MailpitClient } from "mailpit-api";

export function MailpitClientStarter(URL){
    const client = new MailpitClient(URL);
        if (client!=null)
            return client
        console.log("error conectiong to mailpit")
        return null
}

export  async function sendEmail(client,to, from, subject,text ) {
  client.sendMessage({
  From: { Email: from || "tecdigitalito@info.ac.cr"},
  To: [{ Email: to||"user@example.test" }],
  Subject: subject,
  Text: text,
});
}
