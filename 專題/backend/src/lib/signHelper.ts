export const signHelper = (date: Date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    /*星座字典*/
    const constellations = [
        { name: "水瓶座", start: { month: 1, day: 20 }, end: { month: 2, day: 18 } },
        { name: "雙魚座", start: { month: 2, day: 19 }, end: { month: 3, day: 20 } },
        { name: "牡羊座", start: { month: 3, day: 21 }, end: { month: 4, day: 19 } },
        { name: "金牛座", start: { month: 4, day: 20 }, end: { month: 5, day: 20 } },
        { name: "雙子座", start: { month: 5, day: 21 }, end: { month: 6, day: 20 } },
        { name: "巨蟹座", start: { month: 6, day: 21 }, end: { month: 7, day: 22 } },
        { name: "獅子座", start: { month: 7, day: 23 }, end: { month: 8, day: 22 } },
        { name: "處女座", start: { month: 8, day: 23 }, end: { month: 9, day: 22 } },
        { name: "天秤座", start: { month: 9, day: 23 }, end: { month: 10, day: 22 } },
        { name: "天蠍座", start: { month: 10, day: 23 }, end: { month: 11, day: 21 } },
        { name: "射手座", start: { month: 11, day: 22 }, end: { month: 12, day: 21 } },
        /*魔羯會跨年另外做判斷 */
    ]
    /*月份日期判斷星座*/
    const sign = constellations.find(c => {
        const startMatch = (month === c.start.month && day >= c.start.day);
        const endMatch = (month === c.end.month && day <= c.end.day);
        return startMatch || endMatch;
    });
    return sign ? sign.name : "魔羯座";
    /*如果找不到就回傳魔羯座，因為可能會跨年所以另外抓出來處理 */
}