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

            // රෙජිස්ටර් නොවූ තත්වය පරීක්ෂා කිරීම සංශෝධනය කරන්න
            if (!PrabathPairWeb.authState.creds.registered) {
                await delay(1000);
                try {
                    const code = await PrabathPairWeb.requestPairingCode(num);
                    console.log("Pairing code generated:", code);
                    
                    if (!res.headersSent) {
                        return res.send({ 
                            status: "success",
                            code: code,
                            message: "Pairing code generated successfully"
                        });
                    }
                } catch (pairError) {
                    console.error("Pairing code error:", pairError);
                    if (!res.headersSent) {
                        return res.status(500).send({ 
                            status: "error",
                            error: "Pairing Failed",
                            message: pairError.message 
                        });
                    }
                }
            }

            PrabathPairWeb.ev.on('creds.update', saveCreds);
            
            PrabathPairWeb.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    console.log("QR code received");
                }
                
                if (connection === "open") {
                    console.log("Connection opened successfully");
                    try {
                        await delay(3000);
                        
                        // Session data ලබාගැනීම
                        if (fs.existsSync('./session/creds.json')) {
                            const sessionData = fs.readFileSync('./session/creds.json');
                            const b64data = Buffer.from(sessionData).toString('base64');
                            
                            const user_jid = jidNormalizedUser(PrabathPairWeb.user.id);
                            
                            // Session data පණිවිඩයක් ලෙස යැවීම
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
                            console.log("Session data sent successfully");
                        }
                        
                    } catch (e) {
                        console.error("Session send error:", e);
                    } finally {
                        // Cleanup
                        await delay(1000);
                        removeFile('./session');
                        console.log("Session cleaned up");
                        process.exit(0);
                    }
                    
                } else if (connection === "close") {
                    console.log("Connection closed:", lastDisconnect?.error);
                    if (lastDisconnect?.error?.output?.statusCode !== 401) {
                        await delay(5000);
                        console.log("Attempting to reconnect...");
                        PrabathPair();
                    }
                }
            });
            
        } catch (err) {
            console.error("Main error:", err);
            if (!res.headersSent) {
                res.status(500).send({ 
                    status: "error",
                    error: "Service Unavailable",
                    message: err.message 
                });
            }
            // Cleanup on error
            removeFile('./session');
        }
    }
    
    return PrabathPair();
});

// Uncaught exception handling
process.on('uncaughtException', function (err) {
    console.log('Caught exception: ' + err);
});

process.on('unhandledRejection', function (err) {
    console.log('Unhandled rejection: ' + err);
});

module.exports = router;
