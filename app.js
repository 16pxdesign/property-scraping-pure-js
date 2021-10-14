const request = require("request");
const {JSDOM} = require("jsdom");
let mysql = require('mysql');
require('dotenv').config()

console.log(process.env.DB_HOST)

async function connectDB() {
    const connection = mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DB
    });

    return new Promise((resolve, reject) => {
        connection.connect((error) => {
            if (error) {
                reject('Error connecting: ' + error.message);
                return;
            }
            console.log('DB status', connection.state)
            resolve(connection);
        });
    });
}

async function querySql(sql, connection) {
    return new Promise((resolve, reject) => {
        connection.query(sql, (error, results) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(results);
        });
    });
}

async function queryObject(sql, obj, connection) {
    return new Promise((resolve, reject) => {
        connection.query(sql, obj, (error, results) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(results);
        });
    });
}


async function fetchData(document) {
    return new Promise(((resolve, reject) => {
        //remove under offers
        new Array(...document.querySelectorAll('.under_offer')).forEach(e => e.parentNode.remove());

        //console.log(document.querySelector('a p').innerHTML)
        //remove Flat
        new Array(...document.querySelectorAll('a p')).filter(x => x.innerHTML.includes('Flat')).forEach(e => e.parentNode.remove())
        //remove Plot
        new Array(...document.querySelectorAll('a p')).filter(x => x.innerHTML.includes('Plot')).forEach(e => e.parentNode.remove())
        //only dundee
        new Array(...document.querySelectorAll('a h2')).filter(x => !x.innerHTML.includes('Dundee')).forEach(e => e.parentNode.remove())

        //map to obj
        let map = new Array(...document.querySelectorAll('a h2')).map(x => x = {
            title: x.innerHTML,
            message: x.parentNode.querySelector('h3[class]') ? x.parentNode.querySelector('h3[class]').innerHTML : '',
            price: parseInt(x.parentNode.querySelector('h3:not([class])').innerHTML.replace(/^\D+/g, '').replace(/,/g, '')),
            type: x.parentNode.querySelector('p').innerHTML,
            url: 'https://www.tspc.co.uk' + x.parentNode.href,
            //img: x.parentNode.querySelector('img').src
        });
        resolve(map)
    }))
}

async function getWebsite() {
    return new Promise(((resolve, reject) => {
        request({
            uri: 'https://www.tspc.co.uk/Search/Property-up-to-120000',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.63 Safari/537.36'
            }
        }, function (err, response, body) {
            if (err) {
                reject(err)
                return
            }
            resolve(body)
        })
    }))
}


async function saveData(data, con) {
    //check

    let sql = `Select * from Offers where title=? and message=? and price=? and type=? and url=?`;
    let arr = [data.title, data.message, data.price, data.type, data.url];
    sql = mysql.format(sql, arr);

    let res = await querySql(sql, con);
    //console.log(res.length)
    if (res.length > 0)
        return
    console.log('change detected')
    //replace and store old
    sql = `Select * from Offers where title=?`
    sql = mysql.format(sql, data.title);
    res = await querySql(sql, con);
    //console.log(res)
    if (res.length > 0) {
        sql = `Delete from Offers where id=?`
        console.log(res[0])
        await queryObject(sql, res[0].id, con);
        sql = `Insert into History Set ?`;
        await queryObject(sql, res, con);

    }

    //save new
    console.log('save new')
    sql = `Insert into Offers Set ?`;
    await queryObject(sql, data, con);

}

async function run() {
    const connection = await connectDB()

    let body = await getWebsite();

    var dom = new JSDOM(body)
    var document = dom.window.document

    let data = await fetchData(document);


    for await (const d of data) {
        await saveData(d, connection)
    }

    console.log('Ending connection')
    connection.end()
}


(async () => {
    await run()
    setInterval(async () => {
        await run()
    }, process.env.REPEAT_TIME * 60_000);

})()








