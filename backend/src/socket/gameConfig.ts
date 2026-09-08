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
        SPORT: { reward: 80, cdSeconds: 10 }         // 撫摸雪兔
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
            // 🌟 01 ~ 04：基礎入門系列
            none: 0,                         // 無背景
            cozy_room: 200,                  // 溫馨房間
            sunshine_grassland: 400,         // 陽光草原
            sunny_park: 500,                 // 陽光公園

            // 🌟 05 ~ 10：自然與日常系列
            misty_forest: 600,               // 迷霧森林
            breeze_morning: 800,             // 微風晨曦
            afternoon_tea: 900,              // 午後茶會
            cherry_park: 1000,               // 櫻花小徑
            bamboo_grove: 1100,              // 翠綠竹林
            rainy_street: 1200,              // 雨中街景

            // 🌟 11 ~ 15：風景與探險系列
            sunset_beach: 1400,              // 夕陽海灘
            autumn_leaves: 1500,             // 秋日楓紅
            deep_sea: 1600,                  // 深海秘境
            snowy_mountain: 1800,            // 銀白雪山
            starry_night: 2000,              // 璀璨星空

            // 🌟 16 ~ 21：奇幻異想系列
            candy_land: 2200,                // 糖果王國
            magic_academy: 2400,             // 魔法學院
            lavender_field: 2500,            // 薰衣草田
            aurora_sky: 2600,                // 夢幻極光
            retro_arcade: 2800,              // 復古街機
            neon_city: 3000,                 // 賽博霓虹

            // 🌟 22 ~ 27：宇宙與奇境系列
            crystal_cave: 3200,              // 水晶洞穴
            galaxy_space: 3400,              // 浩瀚銀河
            desert_oasis: 3500,              // 沙漠綠洲
            ancient_ruins: 3600,             // 遠古遺跡
            volcano_core: 3800,              // 熔岩火山
            floating_island: 4000,           // 浮空島嶼

            // 🌟 28 ~ 32：頂級殿堂系列
            underwater_temple: 4200,         // 亞特蘭提斯
            cyber_matrix: 4500,              // 數位母體
            celestial_realm: 4800,           // 雲端神域
            dream_wonderland: 5000,          // 夢境仙境
            royal_palace: 5200               // 皇家宮殿
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