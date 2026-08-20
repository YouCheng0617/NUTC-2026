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
        FEED: { reward: 80, cdSeconds: 8 },      // 餵食海藻
        PURIFY: { reward: 100, cdSeconds: 15 },   // 淨化水質
        PET: { reward: 50, cdSeconds: 5 }         // 撫摸雪兔
    },
    shop: {
        pet_color: {
            snow: 0,              // 經典雪兔
            ocean: 1200,          // 深海藍寶
            matcha: 1500,         // 抹茶麻糬
            berry: 1800,          // 草莓牛奶
            choco: 2000,          // 焦糖布丁
            grape: 2200,          // 薰衣草
            lemon: 2500,          // 黃金檸檬
            sesame: 2800,         // 黑糖芝麻
            sakura: 3000,         // 櫻花雪兔
            peachSlug: 3200,      // 甜心水蜜桃
            banana: 3200,         // 香蕉牛奶
            blueberry: 3400,      // 藍莓起司
            avocado: 3400,        // 酪梨優格
            mint: 3500,           // 薄荷巧克力
            springBlossom: 3500,  // 春日櫻笛
            summerBreeze: 3500,   // 夏日微風
            autumnMaple: 3500,    // 秋意楓紅
            winterSnow: 3500,     // 冬夜初雪
            taro: 3600,           // 香芋布丁
            papaya: 3600,         // 木瓜牛奶
            watermelon: 3800,     // 清涼西瓜
            kiwi: 3800,           // 奇異果派
            dragonfruit: 4000,    // 火龍果精靈
            mango: 4000,          // 夏日芒果
            ruby: 4200,           // 璀璨紅寶石
            sapphire: 4200,       // 皇家藍寶石
            emeraldSlug: 4200,    // 微光祖母綠
            amethyst: 4200,       // 夢幻紫水晶
            topaz: 4200,          // 耀眼托帕石
            coconut: 4200,        // 椰香白巧
            galaxy: 4500,         // 星空宇宙
            jade: 4500,           // 溫潤白玉
            macaron: 4500,        // 法式馬卡龍
            cottonCandy: 4500,    // 夢幻棉花糖
            puddingCaramel: 4500, // 焦糖布丁燒
            matchaLatte: 4500,    // 特濃抹茶拿鐵
            obsidian: 4800,       // 神祕黑曜石
            sunset: 5000,         // 日落晚霞
            pearl: 5000,          // 極光珍珠
            halloweenBat: 5000,   // 萬聖小蝙蝠
            christmasTree: 5000,  // 耶誕小樹
            valentineRose: 5000,  // 情人玫瑰
            newYearTiger: 5000,   // 迎春小福虎
            amber: 5200,          // 千年琥珀
            coffee: 5500,         // 焦糖拿鐵
            coralSlug: 5500,      // 海底珊瑚
            ghost: 6000,          // 幽靈白兔
            unicorn: 6500,        // 獨角獸之夢
            frost: 6500,          // 永凍冰晶
            storm: 6800,          // 雷鳴風暴
            phoenix: 7000,        // 不死鳥之羽
            magma: 7200,          // 熔岩之心
            dragonSlug: 7500,     // 烈焰小龍
            starlight: 7800,      // 流星微光
            nebula: 8000,         // 璀璨星雲
            eclipse: 8500,        // 日蝕幻影
            gold: 8888,           // 招財純金
            abyssSlug: 9000       // 深淵使者
        },
        background_color: {
            sky: 0,                   // 基礎藍
            tvStatic: 1000,           // 阿嬤的舊電視
            ocean: 1000,              // 神祕海洋
            beach: 1200,              // 陽光沙灘
            sunset: 1500,             // 唯美落日
            midnight: 1500,           // 靜謐星空
            strawberryMilk: 1500,     // 草莓牛奶
            desert: 1600,             // 無垠沙海
            matchaLatte: 1600,        // 宇治抹茶
            pudding: 1700,            // 焦糖布丁
            forest: 1800,             // 精靈森林
            snowfield: 1800,          // 極地雪原
            blueberryJam: 1800,       // 藍莓果醬
            taroPaste: 1800,          // 香芋泥泥
            mintChoco: 1900,          // 薄荷巧克
            aurora: 2000,             // 極光祕境
            coffeeShop: 2000,         // 午後拿鐵
            lavender: 2100,           // 薰衣草田
            honeyPot: 2100,           // 小熊蜜罐
            volcano: 2200,            // 烈焰火山
            tomatoGarden: 2200,       // 番茄樂園
            coralReef: 2300,          // 七彩珊瑚
            autumnLeaves: 2400,       // 楓葉深秋
            peachOrchard: 2400,       // 水蜜桃季
            cherryBlossom: 2500,      // 櫻花小徑
            toxicSwamp: 2500,         // 史萊姆毒沼
            catCafe: 2800,            // 貓咪咖啡廳
            abyss: 3000,              // 無底深淵
            movieTheater: 3000,       // 午夜電影院
            lunarBase: 3200,          // 月球基地
            hauntedHouse: 3300,       // 幽靈洋館
            bathhouse: 3400,          // 溫泉澡堂
            galaxy: 3500,             // 銀河星系
            candyLand: 3600,          // 魔法糖果屋
            nebula: 3800,             // 粉紅星雲
            cloudCastle: 3800,        // 雲端城堡
            crystalCave: 4000,        // 水晶石洞
            dragonNest: 4200,         // 巨龍巢穴
            bloodMoon: 4400,          // 猩紅之月
            supernova: 4500,          // 超新星爆發
            artistCanvas: 4500,       // 畫布上的塗鴉
            vaporwave: 4800,          // 蒸氣波迷夢
            blackHole: 5000,          // 黑洞視界
            neonCity: 5200,           // 霓虹不夜城
            cyberpunk: 5500,          // 賽博龐克
            matrix: 6000,             // 母體數據流
            heartbeat: 6666,          // 心動小鎮
            rainbowBridge: 7777,      // 彩虹樂園
            noCodeParadise: 8888,     // 拒絕寫Code天堂
            goldenMine: 9999          // 暴富金礦
        },
        background_effects: {
            none: 0,                 // 無特效
            poop: 500,              // 黃金天降
            rain: 800,              // 綿綿細雨
            zzz: 1000,              // 強烈睡意
            sweat: 1000,            // 尷尬流汗
            tvStatic: 1000,         // 阿嬤的舊電視
            bubble: 1200,           // 夢幻泡泡
            math: 1200,             // 數學當機
            leaf: 1400,             // 落葉紛飛
            tomato: 1500,           // 小番茄煙火
            snow: 1500,             // 初雪飄落
            sun: 1500,              // 陽光普照
            moon: 1500,             // 月光灑落
            noClass: 1600,          // 不想上課
            sheep: 1600,            // 數羊羊
            cookie: 1600,           // 餅干碎屑
            boba: 1700,             // 珍奶珍珠
            heartbeat: 1800,        // 心動滿滿
            star: 1800,             // 繁星閃爍
            duck: 1800,             // 黃色小鴨
            coffee: 1800,           // 咖啡續命
            fish: 1900,             // 深海魚群
            fries: 1900,            // 薯條雨
            paint: 2000,            // 揮灑顏料
            firefly: 2000,          // 螢火蟲
            pizza: 2000,            // 披薩派對
            balloon: 2000,          // 彩色氣球
            sparkle: 2000,          // Bling閃光
            butterfly: 2100,        // 蝴蝶翩翩
            cake: 2100,             // 甜點時間
            sakura: 2200,           // 櫻花飛舞
            sushi: 2200,            // 迴轉壽司
            music: 2200,            // 跳動音符
            bat: 2300,              // 吸血蝙蝠
            lightning: 2400,        // 閃電交加
            feather: 2400,          // 天使羽毛
            disco: 2500,            // 回程挑釁
            ghost: 2500,            // 小幽靈
            confetti: 2500,         // 派對拉炮
            gear: 2600,             // 齒輪運轉
            card: 2700,             // 魔術撲克
            rainbowStars: 2800,     // 彩虹星塵
            gift: 2800,             // 驚喜禮物
            meteor: 3000,           // 流星雨
            potion: 3200,           // 煉金藥水
            magic: 3500,            // 魔法詠唱
            clock: 3600,            // 時光倒流
            sword: 3800,            // 勇者之劍
            ufo: 4000,              // 外星綁架
            planet: 4200,           // 行星軌道
            crown: 5000,            // 加冕皇冠
            bugFree: 8888,          // Bug退散
            money: 9999             // 財富自由
        }
    }
}