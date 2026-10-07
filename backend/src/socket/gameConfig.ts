export const gameConfig = {
    // 每日簽到設定 (14 天循環，第 7 天與第 14 天 200 金幣，其餘天數 100 金幣)
    signIn: {
        cycleDays: 14,
        rewards: [
            { day: 1, coin: 100 },
            { day: 2, coin: 100 },
            { day: 3, coin: 100 },
            { day: 4, coin: 100 },
            { day: 5, coin: 100 },
            { day: 6, coin: 100 },
            { day: 7, coin: 200 },
            { day: 8, coin: 100 },
            { day: 9, coin: 100 },
            { day: 10, coin: 100 },
            { day: 11, coin: 100 },
            { day: 12, coin: 100 },
            { day: 13, coin: 100 },
            { day: 14, coin: 200 }
        ]
    },
    actions: {
        FEED: { reward: 80, cdSeconds: 8 },          // 餵食海藻
        PURIFY: { reward: 100, cdSeconds: 15 },      // 淨化水質
        PET: { reward: 60, cdSeconds: 10 },          // 撫摸雪兔
        MONEY_EXCHANGE: { reward: 120, cdSeconds: 5 }, // 財富自由小遊戲：接滿金幣後兌換，5 秒冷卻防止連發
        MUSIC_NOTE: { reward: 15, cdSeconds: 0.5 },    // 跳動音符：點飄浮音符收集，0.5 秒冷卻防止連發
        MUSIC_BUY_NOTE: { reward: -1, cdSeconds: 0 }   // 跳動音符：商店買一個音符扣 1 分
    },
    // 每日任務：當天 (台北時間) 做過對應互動就能領一次額外獎勵，數字與前端 getDailyTaskData 一致
    dailyTasks: {
        pet: { reward: 60 },    // 跟寵物玩
        feed: { reward: 80 },   // 餵食
        clean: { reward: 100 }  // 清理魚缸
    },
    // 財富自由兌換規則：接滿幾枚換一次、每天最多換幾次
    moneyGame: {
        coinsPerExchange: 50,
        dailyLimit: 0           // 每天最多換幾次（0 = 不限制）
    },
    // 記憶翻牌對決（連線房間裡玩，邏輯在 memoryGame.ts）
    memoryGame: {
        // 寵物牌組數（不含鬼牌），牌面從 shop.pet_color 隨機抽，最多就是寵物顏色的種類數。
        // 人多不能選太少：依房間人數有最低組數（鬼牌開啟時再另外多一對）
        minPairsByPlayers: { 2: 12, 3: 18, 4: 24, 5: 30, 6: 44 } as Record<number, number>,
        maxStreak: 3,                  // 翻對可以繼續翻，同一回合最多連續翻對 3 組就換人
        turnSeconds: 30,               // 每回合限時，時間到自動換下一位
        inviteSeconds: 15,             // 房主開局後等大家回覆「加入／觀戰」幾秒，時間到就用有加入的人開局
        minPlayers: 2,
        idleStrikesToKick: 2,          // 輪到時整回合沒翻牌記一次，累計 2 次就請出對決（斷線的人也一樣）
        forfeitWinRatio: 0.8,          // 有人退出後只剩 1 人：寵物牌（不含鬼牌）翻完 80% 才算他贏，不到就作廢
        // 中途離開（按離開房間、或掛機／斷線沒回來被請出）的處罰：當天第 1～4 次，第 5 次起都照第 4 次。
        // 積分扣到 0 為止；banMinutes 期間不能開房、進房
        quitPenalties: [
            { coin: 50, banMinutes: 3 },
            { coin: 100, banMinutes: 5 },
            { coin: 250, banMinutes: 10 },
            { coin: 1000, banMinutes: 60 },
        ],
        // 鬼牌：牌堆多放一對，但翻到任何一張就把還沒配對的牌全部重洗（已配對的不動）、不加分、直接換下一位。
        // 設計師還沒畫好牌面，先關著
        joker: { enabled: false },
        // 機會／命運牌：規則還沒定，先留開關，邏輯尚未實作
        chanceCards: { enabled: false },
        // 贏滿幾場送小丑皮膚（存進 PetInventory 的 pet_color / joker，設計師畫好後前端 speciesData 補上 joker 就能穿）
        jokerSkin: { winsRequired: 10, itemName: "joker" }
    },
    shop: {
        pet_color: {
            snow: 0,              // 經典雪兔
            ocean: 150,          // 深海藍寶
            matcha: 150,         // 抹茶麻糬
            berry: 200,          // 草莓牛奶
            choco: 250,          // 焦糖布丁
            grape: 250,          // 薰衣草
            lemon: 300,          // 黃金檸檬
            sesame: 350,         // 黑糖芝麻
            sakura: 350,         // 櫻花雪兔
            peachSlug: 400,      // 甜心水蜜桃
            banana: 400,         // 香蕉牛奶
            blueberry: 450,      // 藍莓起司
            avocado: 450,        // 酪梨優格
            mint: 500,           // 薄荷巧克力
            springBlossom: 500,  // 春日櫻笛
            summerBreeze: 500,   // 夏日微風
            autumnMaple: 500,    // 秋意楓紅
            winterSnow: 500,     // 冬夜初雪
            taro: 550,           // 香芋布丁
            papaya: 550,         // 木瓜牛奶
            watermelon: 600,     // 清涼西瓜
            kiwi: 600,           // 奇異果派
            dragonfruit: 600,    // 火龍果精靈
            mango: 600,          // 夏日芒果
            ruby: 650,           // 璀璨紅寶石
            sapphire: 650,       // 皇家藍寶石
            emeraldSlug: 650,    // 微光祖母綠
            amethyst: 650,       // 夢幻紫水晶
            topaz: 650,          // 耀眼托帕石
            coconut: 650,        // 椰香白巧
            galaxy: 700,         // 星空宇宙
            jade: 700,           // 溫潤白玉
            macaron: 700,        // 法式馬卡龍
            cottonCandy: 700,    // 夢幻棉花糖
            puddingCaramel: 700, // 焦糖布丁燒
            matchaLatte: 700,    // 特濃抹茶拿鐵
            obsidian: 750,       // 神祕黑曜石
            sunset: 800,         // 日落晚霞
            pearl: 800,          // 極光珍珠
            halloweenBat: 800,   // 萬聖小蝙蝠
            christmasTree: 800,  // 耶誕小樹
            valentineRose: 800,  // 情人玫瑰
            newYearTiger: 800,   // 迎春小福虎
            amber: 850,          // 千年琥珀
            coffee: 900,         // 焦糖拿鐵
            coralSlug: 900,      // 海底珊瑚
            ghost: 950,          // 幽靈白兔
            unicorn: 1000,        // 獨角獸之夢
            frost: 1000,          // 永凍冰晶
            storm: 1050,          // 雷鳴風暴
            phoenix: 1100,        // 不死鳥之羽
            magma: 1150,          // 熔岩之心
            dragonSlug: 1200,     // 烈焰小龍
            starlight: 1300,      // 流星微光
            nebula: 1350,         // 璀璨星雲
            eclipse: 1400,        // 日蝕幻影
            gold: 1450,           // 招財純金
            abyssSlug: 1500       // 深淵使者
        },
        background_color: {
            // 與前端 slug_game.js 的 bgData 同步，前端刪掉的背景這裡也要刪
            // 🌟 基礎入門系列
            none: 0,                      // 自選純色（顏色存在前端，後端只認這個免費項目）
            cozy_room: 100,               // 溫馨房間
            sunshine_grassland: 150,      // 陽光草原
            sunny_park: 200,              // 陽光公園

            // 🌟 自然與日常系列
            misty_forest: 250,            // 迷霧森林
            breeze_morning: 300,          // 碧紗庭院
            afternoon_tea: 350,           // 午後茶會
            cherry_park: 400,             // 櫻花小徑
            bamboo_grove: 300,            // 翠綠竹林
            rainy_street: 500,            // 雨中街景

            // 🌟 風景與奇幻系列
            autumn_leaves: 600,           // 秋日楓紅
            starry_night: 800,            // 璀璨星空
            candy_land: 900               // 糖果王國
        },
        background_effects: {
            none: 0,                 // 無特效
            poop: 500,               // 便便來襲
            rain: 800,               // 綿綿細雨
            zzz: 800,                // 睡意來襲 (依前端 effectData cost 改為 800)
            cat: 1000,               // 貓貓降臨 (前端新增)
            tvStatic: 1000,          // 阿嬤的舊電視
            bubble: 1200,            // 夢幻泡泡
            math: 1200,              // 數學當機
            leaf: 1400,              // 落葉紛飛
            tomato: 1500,            // 小番茄煙火
            snow: 1500,              // 初雪飄落
            sun: 1500,               // 陽光普照
            moon: 1500,              // 月光灑落
            sheep: 1600,             // 數羊羊
            star: 1800,              // 繁星閃爍
            duck: 1800,              // 黃色小鴨
            fish: 1900,              // 深海魚群
            paint: 2000,             // 揮灑顏料
            butterfly: 2100,         // 蝴蝶翩翩
            sakura: 2200,            // 櫻花飛舞
            lightning: 2400,         // 閃電交加
            disco: 2500,             // 回程挑釁
            ghost: 2500,             // 小幽靈
            confetti: 2500,          // 派對拉炮
            gear: 2600,              // 齒輪運轉
            bugFree: 4800,           // Bug退散 (依前端 effectData cost 改為 4800)
            money: 5000,             // 財富自由 (依前端 effectData cost 改為 5000)
            music: 5200              // 跳動音符 (依前端 effectData cost 改為 5200)
        }
    }
}