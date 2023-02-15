import LocalStrategy from "passport-local";
import passport from "passport"; 
import { Vonage } from '@vonage/server-sdk';
function passport_auth() {
    passport.use(new LocalStrategy(function asyncverify(apiKey, apiSecret, cb) {
        if (process.env.API_KEY !== apiKey) {
            return cb(null, false, { message: 'Incorrect API Key.' })
        }

        const vonage = new Vonage({
            apiKey: apiKey,
            apiSecret: apiSecret
        });
        
        vonage.secrets.listSecrets(apiKey)
        .then(() => {
            return cb(null, { id: "0", username: apiKey })

        }).catch( err => {
            return cb(null, false, { message: 'Incorrect Secret.' })

        });
    }));

    passport.serializeUser(function (user, cb) {
        console.log("Serialized Called")
        process.nextTick(function () {
            cb(null, { id: user.id, username: user.username });
        });
    });

    passport.deserializeUser(function (user, cb) {
        console.log("Deserialized Called", user)
        process.nextTick(function () {
            console.log("next")
            return cb(null, user);
        });
    });


}
export { passport_auth, passport}