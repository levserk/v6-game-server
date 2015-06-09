# V6-Game-Server

Сервер на node.js для пошаговых игр.

## Установка

	npm install v6-game-server
	
## Запуск
	
```js
		var Server = require('v6-game-server',
			// настройки
			conf = {},
			// игровой движок
			engine = {},
			// сервер
			server = new Server(conf, engine);
		
		server.start();
```
	
## Настройки
	Настройки сервера с параметрами по умолчанию
	
```js
	{
		game: 'default',        	// обязательный парамерт, алиас игры и бд
		port: 8080,             	// порт подключения веб сокета
		pingTimeout:100000,     	// таймаут клиента в мс
		pingInterval:10000,     	// интервал пинга клиента в мс
		closeOldConnection: true, 	// закрывать старое соединение клиента, при открытии нового  
		loseOnLeave: false,     	// засчитывать поражение при разрыве соединения с клиентом
		reconnectOldGame: true, 	// загружать игру клинета, в которой произошел разрыв
		spectateEnable: true,   	// разрешить просмотр игр
		logLevel:3,             	// уровень подробности лога, 0 - без лога, 1 - только ошибки
		turnTime: 100,              // время на ход игрока в секундах
		resetTimerEveryTurn: false, // сбрасывать время игрока после каждого его хода
		maxTimeouts: 1,         	// разрешенное число пропусков хода игрока подряд до поражения
		clearTimeouts: true,		// обнулять число пропусков игрока после его хода
		maxOfflineTimeouts: 1,  	// число пропусков отключенного игрока подряд до поражения
		minTurns: 0,            	// минимальное число число ходов (переходов хода) для сохранения игры
		takeBacks: 0,           	// число разрешенных игроку ходов назад
		loadRanksInRating: false,   // загружать актуальные ранги при открытии таблицы рейтинга
		ratingUpdateInterval: 1000, // интервал обновления рангов в списке игроков
		penalties: false,       	// загружать штарфы игроков
		mode: 'debug',          	// значение 'develop' уставновит режим без использования бд
		gameModes: ['default'], 	// игровые режимы, со своим рейтингом и историей, имена без пробелов
		modesAlias:{default:'default'}, // отображаемые клиенту алиасы режимов
		adminList: [],				// список userId админов
		adminPass: '',				// пароль для функций администратора
		mongo:{                 	// настройки подключения mongodb
			host: '127.0.0.1',
			port: '27017'
		},
		https: true,				// настройки https
		httpsKey: '/path../serv.key',
		httpsCert: '/path../serv.crt',
		httpsCa: ['/path../sub.class1.server.ca.pem', '/path../ca.pem'],
	}
```
## Игровой движок
	Методы игрового движка
	
``` js
	{
		/**
		 * вызывается после соединения нового пользователя в первый раз
		 * устанавливает значения нового пользователя по умолчанию
		 * рейтинги, очки, и т.д.
		 */
		initUserData: function(mode, modeData){
			return modeData;
		},
		
		/**
		 * вызывается перед началом игрового раунда
		 * возвращаемый объект будет передан всем игрокам в начале раунда
		 * по умолчанию возвращает объект переданный игроком в приглашении
		 */
		initGame: function (room) {
			return {
				inviteData: room.inviteData
			}
		},

		/**
		 * вызывается в начале раунда
		 * возвращает игрока, который будет ходить первым
		 * по умолчанию первым ходит создатель комнаты, 
		 * в следующем раунде ход переходит к другому игроку
		 */
		setFirst: function (room) {
			if (!room.game.first) return room.owner;
			if (room.players[0] == room.game.first)
				return room.players[1];
			else
				return room.players[0];
		},

		/**
		 * вызывается каждый ход игрока
		 * возвращаемый объект будет передан всем игрокам и записан в историю
		 * если вернуть false || null || undefined ход будет признан некорректным
		 */
		doTurn: function(room, user, turn){
			return turn;
		},

		/**
		 * вызывается после каждого пропуска хода
		 * вовращаемый объект будет передан всем игрокам и записан в историю
		 * @param room
		 * @param user
		 * @returns {Object}
		 */
		onTimeout: function(room, user){
			return {action: 'timeout'};
		},

		/**
		 * вызывается каждый ход игрока или после события пропуска хода
		 * возвращаемый игрок будет ходить следующим
		 * если вернуть того же игрока, чей был ход, ход останется за ним
		 */
		switchPlayer: function(room, user, turn){
			if (turn == 'timeout'){
				// this is user timeout
			}
			if (room.players[0] == user) return room.players[1];
			else return room.players[0];
		},

		/**
		 * вызывается после отправке игроком события
		 * возвращаемый объект будет передан заданным игрокам, и должен быть следующего вида:
		 * { event, target, user } || [Array], где
		 * event - объект с обязательным полем type
		 * target - цель для отправки события null || Room || User
		 * может быть массивом с разными объектами событий и целями
		 */
		userEvent: function(room, user, event){
			return {
				event: event,
				target: room,
				user: user.userId
			}
		},

		/**
		 * вызывается в начале раунда и после каждого хода игрока
		 * возвращаемый объект будет передан заданным игрокам, и должен быть следующего вида:
		 * { event, target, user } || [Array], где
		 * event - объект с обязательным полем type
		 * target - цель для отправки события null || Room || User
		 * может быть массивом с разными объектами событий и целями
		 */
		gameEvent: function(room, user, turn, roundStart){
		   return null;
		},

		/**
		 * вызывается каждый ход, определяет окончание раунда
		 * возвращаемый объект будет передан всем игрокам 
		 * и должен быть вида {winner : user}, где
		 * user - User (игрок победитель ) || null (ничья)
		 * если вернуть false - раунд еще не окончен
		 * если пользователь не подключен игра завешится по
		 * максимальному числу офлайн таймаутов
		 * если не подключены оба, завершится поражением пропустившего
		 * если не обрабатывать пропускать ход можно бесконечно
		 */
		getGameResult: function(room, user, turn){
			// timeout
			if (turn == 'timeout'){
				// if user have max timeouts, other win
				if (room.data[user.userId].timeouts == room.maxTimeouts){
					return {
						winner: room.players[0] == user ? room.players[1] : room.players[0]
					};
				} else return false;
			}

			// turn
			switch (turn.result){
				case 0: // win other player
					return {
						winner: room.players[0] == user ? room.players[1] : room.players[2]
					};
					break;
				case 1: // win current player
					return {
						winner: user
					};
					break;
				case 2: // draw
					return {
						winner: null
					};
					break;
				default: // game isn't end
					return false;
			}
		},

		/**
		 * вызывается по окончанию раунда
		 * возвращаемый объект утсанавливает значение очков игроков 
		 * room.players[0][room.mode].['score'] = new_score
		 */
		getUsersScores: function(room, result){
			// например
			for (var i = 0; i < room.players.length; i++){
            if (room.players[i] == result.winner)
                room.players[i][room.mode].score += 10;
            else room.players[i][room.mode].score -= 10;
        }
        return result;
		},

		/**
		 * вызывается после авторизации пользователя
		 * проверяет подлинноть подписи
		 */
		checkSign: function(user){
			return (user.userId && user.userName && user.sign);
		}
	};
```

## Игровые сущности

	Room
	
``` js
	{
		owner: User, 		// создатель
		players: Array,		// массив с игроками
		spectators: Array,	// массив зрителей
		inviteData: Object	// объект приглашения
		mode: String		// режим
		games: Int;			// сыграно раундов
		turnTime = Int;		// время на ход
		game: {
			state: String 	// состояние игры:  waiting,  playing, end
			current: User,	// текущий игрок
			history: Array,	// массив с иторией ходов и событий
			shistory: String// массив с историей преобразоыанный в строку
			turnTime: UTC 	// дата начала хода игрока
		},
		data: Object		// массив ключ значение, где ключи - userId
							// для хранения временной информации для каждого игрока
	}
```
	
	User
	
``` js
	{
		userId: String, 	// идетификатор игрока
		userName: String	// имя	
		sign: String		// подпись
		currentRoom: Room	// текущая комната (играет или зритель)
	}
```
