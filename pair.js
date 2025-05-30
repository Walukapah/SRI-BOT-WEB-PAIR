const express = require('express');
const fs = require('fs');
const { exec } = require("child_process");
let router = express.Router()
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let num = req.query.number;
    
    // දුරකථන අංකය වලංගු කිරීම
    num = num?.replace(/[^0-9]/g, '') || '';
    
    if (!num) {
        return res.status(400).send({ 
            status: "error",
            error: "Invalid input",
            message: "දුරකථන අංකය සපයා නැත" 
        });
    }

    async function PrabathPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            let PrabathPairWeb = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" }))
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari")
            });

            if (!PrabathPairWeb.authState.creds.registered) {
                await delay(1500);
                const code = await PrabathPairWeb.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ 
                        status: "success",
                        code: code,
                        message: "Pairing code generated successfully"
                    });
                }
            }

            PrabathPairWeb.ev.on('creds.update', saveCreds);
            PrabathPairWeb.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    try {
                        await delay(10000);
                        const sessionData = fs.readFileSync('./session/creds.json');
                        const b64data = Buffer.from(sessionData).toString('base64');
                        
                        const user_jid = jidNormalizedUser(PrabathPairWeb.user.id);
                        
                        await PrabathPairWeb.sendMessage(user_jid, {
                            text: `SRI-BOT~${b64data}`
                        });
                        
                        const successMsg = `
┏━━━━━━━━━━━━━━
┃ PRABATH MD සැසිය 
┃ සාර්ථකව සම්බන්ධ විය ✅
┗━━━━━━━━━━━━━━━
▬▬▬▬▬▬▬▬▬▬▬▬▬▬
ඔබගේ සැසි දත්ත ඉහත පණිවිඩයේ ඇත. 
මෙය ආරක්ෂිතව ගබඩා කරන්න!
▬▬▬▬▬▬▬▬▬▬▬▬▬▬`;
                        
                        await PrabathPairWeb.sendMessage(user_jid, { text: successMsg });

                    } catch (e) {
                        console.error("දෝෂය:", e);
                        exec('pm2 restart prabath');
                    }

                    await delay(100);
                    await removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(10000);
                    PrabathPair();
                }
            });
        } catch (err) {
            console.error("දෝෂය:", err);
            exec('pm2 restart prabath');
            await removeFile('./session');
            if (!res.headersSent) {
                await res.status(500).send({ 
                    status: "error",
                    error: "Service Unavailable",
                    message: err.message 
                });
            }
        }
    }
    return await PrabathPair();
});

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
    exec('pm2 restart prabath');
});

module.exports = router;
