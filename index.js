import { neru } from 'neru-alpha';
import express from 'express';
import cors from 'cors';
import cel from "connect-ensure-login"
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { passport_auth, passport } from "./auth/passportAuth.js";
import flash from "express-flash";
import bodyParser from 'body-parser';
import hpm from 'http-proxy-middleware';
import csrf from 'csurf'
import cookieParser from 'cookie-parser'
import cookieSession from 'cookie-session'


const __dirname = dirname(fileURLToPath(import.meta.url));
const views_path = __dirname + '/views/';
const ensureLoggedIn = cel.ensureLoggedIn
const { createProxyMiddleware, fixRequestBody} = hpm;
const csrfProtection = csrf({ cookie: true })

const app = express();
const port = process.env.NERU_APP_PORT || 3002;

const COMPANY_CB = {
   'key': 'company_cb',
   'value': 'url'
}

app.use(flash());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser())

app.set('view engine', 'ejs');
app.use(cors());
app.use(express.json());
passport_auth()
app.use(express.static(__dirname + '/public'));
app.use(cookieSession({
    name: 'session',
    keys: ["companyCb"],
    secure: false,
    resave: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
}))
app.use(function(req, res, next) {
    try{
        res.locals.csrfToken = req.csrfToken();  
    }catch(e){
        //nothing
    }
    next();
});

app.use(passport.authenticate('session'));

// Setup proxy
const customRouter = async function (req) {  
    let companyurl = await getGlobalState(COMPANY_CB.key, COMPANY_CB.value)

    if (!req || !companyurl) return companyurl ?? 'http://localhost:8000/test';

    const dynamicParameter = companyurl.match(/(?<=\{\{).+?(?=\}\})/g)

    // replace url variable
    if (Array.isArray(dynamicParameter)) {
        dynamicParameter.forEach((paramKey) => {
            companyurl = companyurl.replace(`{{${paramKey}}}`, req.body[paramKey] ?? req.query[paramKey] ?? "")
        })
    }

    return companyurl
};

const filter = function(pathname, req) {
    const allowedState = ['delivered', 'expired', 'failed',  'rejected', 'unknown']
    let status = "defaultstate"
    if (req.method === 'GET') {
        status = req.query.status.toLowerCase()
    }
    else if (req.method === 'POST') {
        status = req.body.status.toLowerCase()
    } 

    return pathname.match('^/dlr') && allowedState.includes(status)
}

const defaultTarget = await customRouter()

const options = {
    target: defaultTarget, // target host
    changeOrigin: true, // needed for virtual hosted sites
    router: customRouter,
    pathRewrite: {
        '^/dlr':'' //remove /service/api
    },
    onProxyReq: (proxyReq, req, res) => {
        fixRequestBody(proxyReq, req);
    }
};

const proxy = createProxyMiddleware(filter, options);
app.use('/dlr', proxy);


app.get('/_/health', async (req, res) => {
    res.sendStatus(200);
});

app.get('/', csrfProtection, (req, res, next) => {
    res.redirect('/config')
})

app.get('/config', csrfProtection, ensureLoggedIn("./login"), (req, res, next) => {
    res.render(views_path + "config.ejs", {csrfToken: req.csrfToken()})
});

app.post('/config', csrfProtection,  async (req, res) => {
    try {
        const url = req.body.callbackURL;
        const dataObj = {}
        dataObj[COMPANY_CB.value] = url
        await setGlobalState(COMPANY_CB.key, dataObj)
        const companyurl = await getGlobalState(COMPANY_CB.key, COMPANY_CB.value)

        if (companyurl === url) {
            res.json({url});
        }
        else {
            res.sendStatus(501);
        }

      } catch (error) {
        res.sendStatus(501)
      }
});

app.get('/login', csrfProtection,  function (req, res, next) {
    res.render(views_path + "login.ejs", { csrfToken: req.csrfToken(), messages: req.flash("error") })

});

app.post('/login',  csrfProtection, passport.authenticate('local', {
    successRedirect: "./config",
    failureRedirect: './login',
    failureFlash: true
}));


app.post('/logout', function (req, res, next) {
    res.clearCookie('session', {path: '/'})
    return res.redirect('/login')
});

app.post("/dlr", (req, res) => {
//    console.log("in post /dlr", req.body)
   res.status(204).send()
})

app.get("/dlr", (req, res) => {
    // console.log("in get /dlr", req.query)
    res.status(204).send()
})

async function getGlobalState(key, dataKey) {
    const instanceState = neru.getGlobalState();
    let result =  await instanceState.hget(key, dataKey);
    return result
}

async function setGlobalState(key, data) {
    const instanceState = neru.getGlobalState();
    await instanceState.hset(key, data);
}

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
});