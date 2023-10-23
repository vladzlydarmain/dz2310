// Підключення необхідних модулей для роботи з телеграм ботами та базами данних
const { Telegraf } = require('telegraf')
const sqlite3 = require('sqlite3').verbose()

// Створення пдключення до телеграм боту
const bot = new Telegraf('6373366804:AAE5_alofKpDkRmufoFt3XjEIhcOJufKUgM')

// Створення бази данних та її екземпляру
const db = new sqlite3.Database('db.sqlite3')


// Функція створення таблиці користувачів у базі данних
function createUserTable(){
    const query = `CREATE TABLE Users(
        id INTEGER PRIMARY KEY,
        status varchar(255),
        friend int
    );`
    db.run(query)
}

// Функція додавання інформації що до користувача у базу данних зі статусом "у пошуку"(співрозмовника)
function addUser(id){
    const query = `INSERT INTO Users (id, status) VALUES(?,?)`
    db.run(query, [id,"in_search"])
}

// Функція отримання данних з бази данних про користувача за його id
function getUser(id, callback){
    const query = `SELECT status, friend FROM Users WHERE id = ${id}`
    db.get(query, (err, res) => {
        callback(res)
    } )
}

// Функція оновлення статусу користувача у базі данних
function updateStatus(id, status){
    const query = `UPDATE Users SET status = '${status}' WHERE id = ${id}`
    db.run(query)
}

// Функція оновлення данних що до спів-розмовника користувача
function updateFriend(id, friend){
    const query = `UPDATE Users SET friend = ${friend} WHERE id = ${id}`
    db.run(query)
}

// Функція отримання переліку користувачів з бази данних зі статусом "у пошуку"
function getInSearchUsers(id, callback){
    const query = `SELECT id FROM Users WHERE status = 'in_search' AND id <> ${id}`
    db.all(query, (err, res) => {
        callback(res)
    })
}

// Функція знаходження співрозмовника для користувача та оновлення статусу на "зустріч" як у користувача так і співрозмовника
function findFriend(id){
    getInSearchUsers(id,(res)=>{
        if (res.length > 0){
            const index = Math.floor(Math.random()*res.length) // Отримання випадкового числа від 0 до довжини списку користувачів зі статусом "у пошуку"
            const randomUser = res[index]
            updateStatus(id, 'meet')
            updateStatus(randomUser.id, 'meet')
            updateFriend(id, randomUser.id)
            updateFriend(randomUser.id, id)
            // Оповіщення що до знаходження співрозмовника 
            bot.telegram.sendMessage(randomUser.id,"Співрозмовника знайдено. Можете спілкуватись") 
            bot.telegram.sendMessage(id,"Співрозмовника знайдено. Можете спілкуватись")
        }
    })
}

// Реагування боту на команду старт
bot.start((ctx) =>{
    // Перевірка на знаходження користувача у базі данних
    getUser(ctx.from.id, (res) => {
        // Якщо данні про користувача вже є в базі данних
        if (res){
            // Якщо користувач має стандартний статус, то він змінюється на статус "у пошуку" та в цей час починається пошук співрозмовника для користувача
            if(res.status == "standart"){
                updateStatus(ctx.from.id, "in_search");
                ctx.reply('Шукаємо співрозмовника')
                findFriend(ctx.from.id)
            } else if(res.status == "in_search"){ // Якщо користувач вже має статус "у пошуку" то вивести повідомлення про те що пошук вже триває
                ctx.reply('Ми вже шукаємо співрозмовника')
            } else if(res.status == "meet"){ // Якщо користувач має статус "зустріч" то попередити про те що він вже знаходиться у розмові 
                ctx.reply('У вас вже є співрозмовник напишіть /stop щоб зупинити бесіду')
            }
        } else{ // Якщо данних про користувача не знайдено у базі то додати його в базу та почати пошук співрозмовника
            addUser(ctx.from.id)
            ctx.reply('Шукаємо співрозмовника')
            findFriend(ctx.from.id)
        }
    })
})

// Реагування боту на команду стоп
bot.command("stop", (ctx)=>{
    // Перевірка на знаходження користувача у базі данних
    getUser(ctx.from.id, (res)=>{
        // Якщо данні про користувача вже є в базі данних
        if (res){ // Якщо данні про користувача знайдено 
            if (res.status == "meet"){ // Якщо користувач має статус "зустріч" то завершити бесіду оновленням статусів та спів розмовників на стандартні значення
                updateStatus(ctx.from.id, "standart")
                updateFriend(ctx.from.id, null)
                updateStatus(res.friend, 'standart')
                updateFriend(res.friend, null)
                ctx.reply('Розмову закінчено.')
                bot.telegram.sendMessage(res.friend,'Співрозмовник завершив бесіду.')
            } else{ // Інакше вивести повідомлення про те що користувач не має співрозмовника
                ctx.reply("У вас немає співрозмовника.")
            }
        }
    })
})

// Реагування боту на текст
bot.on('text',(ctx)=>{
    // Перевірка на знаходження користувача у базі данних
    getUser(ctx.from.id,(res)=>{
        // Якщо данні про користувача вже є в базі данних
        if (res){
            if (res.status == 'meet'){ // Якщо користувач має статус "зустріч" то перенаправити його повідомлення до співрозмовника
                bot.telegram.sendMessage(res.friend,ctx.message.text)
            } else { // Інакше запитати "З ким ви спілкуєтесь?"
                ctx.reply('З ким ви спілкуєтесь?')
            }
        } else { // Якшо користувача не знайдено в базі данних то повідомити що "Напишіть /start щоб знайти співрозмовника."
            ctx.reply('Напишіть /start щоб знайти співрозмовника.')
        }
    })
})

// Запуск боту 
bot.launch()  

