import { nanoid } from 'nanoid'
import type { OrderType } from '@fakemart/shared'

export function svgDataUri(label: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="675" viewBox="0 0 900 675"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs><rect width="900" height="675" fill="url(#g)"/><circle cx="730" cy="110" r="130" fill="rgba(255,255,255,.34)"/><circle cx="160" cy="560" r="180" fill="rgba(255,255,255,.24)"/><text x="70" y="350" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#213547">${label}</text><text x="74" y="410" font-family="Arial, sans-serif" font-size="28" fill="#3f4b5f">假装购精选店铺</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const productImages: Record<string, string> = {
  'p-phone': 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
  'p-headphone': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
  'p-keyboard': 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=80',
  'p-airfryer': 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80',
  'p-lamp': 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80',
  'p-storage': 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=900&q=80',
  'p-bedding': 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
  'p-cleaner': 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=900&q=80',
  'p-serum': 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=80',
  'p-lipstick': 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=900&q=80',
  'p-coat': 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
  'p-sneaker': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
  'p-snackbox': 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=900&q=80',
  'p-book': 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80',
  'p-tent': 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=900&q=80',
  'p-coffee-latte': 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80',
  'p-coffee-sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80',
  'p-noodle-beef': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80',
  'p-noodle-wonton': 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=900&q=80',
  'p-tea-milk': 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=900&q=80',
  'p-tea-fruit': 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=900&q=80',
  'p-bento-chicken': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
  'p-bento-veggie': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80',
  'p-tablet': 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=900&q=80',
  'p-watch': 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
  'p-camera': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80',
  'p-chair': 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?auto=format&fit=crop&w=900&q=80',
  'p-diffuser': 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=80',
  'p-toy-blocks': 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=900&q=80',
  'p-pet-bed': 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80',
  'p-yoga-mat': 'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?auto=format&fit=crop&w=900&q=80',
  'p-running-tee': 'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=900&q=80',
  'p-burger-classic': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
  'p-burger-chicken': 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=900&q=80',
  'p-fries': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80',
  'p-pizza': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80',
  'p-cake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80',
  'p-icecream': 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?auto=format&fit=crop&w=900&q=80',
  'p-bbq-lamb': 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80',
  'p-sushi-set': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80',
  'p-salad-chicken': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=80',
  'p-bakery-croissant': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=80',
  'p-coffee-americano': 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
  'p-coffee-mocha': 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=900&q=80',
  'p-noodle-spicy': 'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?auto=format&fit=crop&w=900&q=80',
  'p-noodle-dry': 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=900&q=80',
  'p-tea-cheese': 'https://images.unsplash.com/photo-1525385133512-2f3bdd039054?auto=format&fit=crop&w=900&q=80',
  'p-tea-boba': 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=900&q=80',
  'p-bento-pork': 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=900&q=80',
  'p-bento-curry': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80',
  'p-burger-nuggets': 'https://images.unsplash.com/photo-1562967916-eb82221dfb36?auto=format&fit=crop&w=900&q=80',
  'p-dessert-tiramisu': 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=80',
  'p-dessert-mille': 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=900&q=80',
  'p-bbq-chicken': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=900&q=80',
  'p-bbq-eggplant': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
  'p-sushi-eel': 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=900&q=80',
  'p-bakery-bagel': 'https://images.unsplash.com/photo-1585478259715-876acc5be8eb?auto=format&fit=crop&w=900&q=80'
}

export const categories = [
  { id: 'cat-digital', name: '数码电器', slug: 'digital', icon: '⌁', description: '手机、电脑、智能设备和家用电器', sortOrder: 10 },
  { id: 'cat-home', name: '家居日用', slug: 'home', icon: '⌂', description: '收纳、清洁、家纺和生活好物', sortOrder: 20 },
  { id: 'cat-beauty', name: '美妆个护', slug: 'beauty', icon: '✧', description: '护肤、彩妆、洗护和个护用品', sortOrder: 30 },
  { id: 'cat-fashion', name: '服饰鞋包', slug: 'fashion', icon: '◈', description: '通勤、运动、配饰和箱包', sortOrder: 40 },
  { id: 'cat-food', name: '食品饮料', slug: 'snacks', icon: '◒', description: '零食、饮料、速食和礼盒', sortOrder: 50 },
  { id: 'cat-books', name: '图书文娱', slug: 'books', icon: '▤', description: '图书、文具、模型和影音', sortOrder: 60 },
  { id: 'cat-sport', name: '运动户外', slug: 'sport', icon: '△', description: '健身、户外、露营和运动装备', sortOrder: 70 },
  { id: 'cat-takeaway', name: '外卖', slug: 'takeaway', icon: '☉', description: '奶茶、简餐、夜宵和咖啡', sortOrder: 80 }
]

export const merchants = [
  merchant('m-digital', '假日电器旗舰店', 'shopping', '#b9e6ff', ['官方感', '极速达'], 38, 0, 0),
  merchant('m-home', '慢生活家居馆', 'shopping', '#cdecc9', ['家居灵感', '包邮'], 46, 0, 0),
  merchant('m-style', '明日衣橱', 'shopping', '#ffd7df', ['通勤', '上新快'], 42, 0, 0),
  merchant('m-cafe', '午后咖啡局', 'food_delivery', '#ffe0a8', ['咖啡', '轻食'], 28, 2000, 400),
  merchant('m-noodle', '热气面馆', 'food_delivery', '#ffc3a4', ['热汤面', '夜宵'], 34, 1800, 300),
  merchant('m-tea', '小确幸茶铺', 'food_delivery', '#d6f5cc', ['奶茶', '果茶'], 25, 1500, 300),
  merchant('m-bento', '认真便当社', 'food_delivery', '#cfdcff', ['便当', '工作餐'], 31, 2200, 500),
  merchant('m-burger', '咔滋汉堡局', 'food_delivery', '#ffd4a3', ['炸鸡汉堡', '套餐'], 29, 2000, 400),
  merchant('m-dessert', '甜度研究所', 'food_delivery', '#ffd7ea', ['甜品', '蛋糕'], 36, 2500, 500),
  merchant('m-bbq', '深夜烧烤铺', 'food_delivery', '#ffc0a8', ['烧烤', '夜宵'], 42, 3000, 600),
  merchant('m-sushi', '青禾寿司', 'food_delivery', '#d8f2ff', ['寿司', '轻食'], 38, 2800, 500),
  merchant('m-bakery', '清晨烘焙房', 'food_delivery', '#ffe5b6', ['面包', '早餐'], 27, 1800, 300)
]

export const products = [
  product('p-phone', 'm-digital', 'cat-digital', 'shopping', '云感轻旗舰手机', '轻薄机身，拍照很会装', '适合深夜突然想换手机的时候。', 399900, 459900, '#b9e6ff', ['数码', '旗舰', '热门'], 98),
  product('p-headphone', 'm-digital', 'cat-digital', 'shopping', '静音降噪耳机', '通勤安静一点点', '把城市噪音关小一点。', 129900, 169900, '#b7c8ff', ['降噪', '通勤'], 86),
  product('p-keyboard', 'm-digital', 'cat-digital', 'shopping', '奶油机械键盘', '敲起来像今天很努力', '桌面党高频冲动商品。', 52900, 69900, '#ffe0f1', ['桌搭', '办公'], 74),
  product('p-airfryer', 'm-digital', 'cat-digital', 'shopping', '透明空气炸锅', '看见薯条变快乐', '厨房升级的人气选择。', 69900, 89900, '#ffe2b8', ['厨房', '家电'], 66),
  product('p-lamp', 'm-home', 'cat-home', 'shopping', '月光阅读台灯', '柔光、无频闪、很会营造氛围', '适合想把房间变成样板间的时候。', 23900, 31900, '#f3ecc2', ['家居', '学习'], 80),
  product('p-storage', 'm-home', 'cat-home', 'shopping', '模块化收纳盒套装', '把杂乱变成截图', '下单前已经开始期待整洁。', 15900, 21900, '#cdecc9', ['收纳', '日用'], 62),
  product('p-bedding', 'm-home', 'cat-home', 'shopping', '云朵四件套', '周末赖床专用', '柔软到只想再看一眼订单。', 42900, 52900, '#cfdcff', ['家纺', '舒适'], 59),
  product('p-cleaner', 'm-home', 'cat-home', 'shopping', '自动洗地机', '拖地这件事交给想象力', '大件冲动消费拦截器。', 189900, 229900, '#d5f7ff', ['清洁', '大件'], 91),
  product('p-serum', 'm-style', 'cat-beauty', 'shopping', '清透精华液', '水润、清爽、吸收快', '通勤包和梳妆台都适合。', 29900, 39900, '#ffd7df', ['护肤', '复购'], 77),
  product('p-lipstick', 'm-style', 'cat-beauty', 'shopping', '日常显气色口红', '出门五分钟，气色一整天', '色号选择困难专用。', 16900, 22900, '#ffb8c5', ['彩妆', '色号'], 72),
  product('p-coat', 'm-style', 'cat-fashion', 'shopping', '城市通勤风衣', '走路自带会议感', '天气没变，购物车先变了。', 79900, 99900, '#e7d4bd', ['通勤', '外套'], 70),
  product('p-sneaker', 'm-style', 'cat-fashion', 'shopping', '轻跑休闲鞋', '从地铁站到咖啡店都合适', '运动计划从今天开始。', 45900, 59900, '#dde8ff', ['运动', '休闲'], 68),
  product('p-snackbox', 'm-home', 'cat-food', 'shopping', '周末零食补给箱', '电影、沙发、快乐补给', '嘴馋的时候刚刚好。', 11900, 15900, '#ffe0a8', ['零食', '周末'], 84),
  product('p-book', 'm-home', 'cat-books', 'shopping', '年度虚构书单套装', '买了就像已经读了', '知识型冲动消费的温柔缓冲。', 25600, 32800, '#e2d4ff', ['图书', '成长'], 48),
  product('p-tent', 'm-home', 'cat-sport', 'shopping', '轻量露营帐篷', '周末逃离城市的入场券', '把山野计划先安排上。', 89900, 119900, '#cdecc9', ['露营', '户外'], 64),
  product('p-coffee-latte', 'm-cafe', 'cat-takeaway', 'food_delivery', '燕麦拿铁', '温柔苦味，适合下午三点', '下午三点的稳定快乐。', 2800, 3200, '#ffe0a8', ['咖啡', '热卖'], 90),
  product('p-coffee-sandwich', 'm-cafe', 'cat-takeaway', 'food_delivery', '厚蛋三明治', '软、香、快', '会议前的轻食补给。', 3200, 3800, '#fff1b8', ['轻食', '早餐'], 67),
  product('p-noodle-beef', 'm-noodle', 'cat-takeaway', 'food_delivery', '番茄牛腩面', '热气腾腾，夜宵友好', '酸甜浓汤配大块牛腩。', 3600, 4200, '#ffc3a4', ['面食', '夜宵'], 88),
  product('p-noodle-wonton', 'm-noodle', 'cat-takeaway', 'food_delivery', '鲜虾小馄饨', '清淡一点也算克制', '胃想下单，钱包先休息。', 2600, 3200, '#ffd4be', ['汤食', '暖胃'], 60),
  product('p-tea-milk', 'm-tea', 'cat-takeaway', 'food_delivery', '桂花乌龙奶茶', '三分糖也很快乐', '今日忍住奶茶金额。', 2200, 2600, '#d6f5cc', ['奶茶', '下午茶'], 93),
  product('p-tea-fruit', 'm-tea', 'cat-takeaway', 'food_delivery', '青提茉莉冰茶', '清爽、漂亮、果香足', '清甜不腻的新品选择。', 2400, 2900, '#d4f7f0', ['果茶', '新品'], 75),
  product('p-bento-chicken', 'm-bento', 'cat-takeaway', 'food_delivery', '照烧鸡腿便当', '工作餐的标准答案', '一份刚刚好的午餐。', 3900, 4600, '#cfdcff', ['便当', '午餐'], 82),
  product('p-bento-veggie', 'm-bento', 'cat-takeaway', 'food_delivery', '时蔬牛肉饭', '认真吃饭，认真省钱', '适合午饭前的理性缓冲。', 4200, 4900, '#d9e8ff', ['便当', '均衡'], 69),
  product('p-tablet', 'm-digital', 'cat-digital', 'shopping', '轻薄办公平板', '开会、追剧、做笔记都顺手', '想提升效率时很容易心动。', 329900, 379900, '#d8e8ff', ['数码', '办公'], 73),
  product('p-watch', 'm-digital', 'cat-digital', 'shopping', '运动健康手表', '心率、睡眠、运动都看得见', '把健康计划戴在手腕上。', 159900, 199900, '#dce8ff', ['穿戴', '运动'], 79),
  product('p-camera', 'm-digital', 'cat-digital', 'shopping', '复古微单相机', '周末出片的仪式感', '记录生活时很有分量。', 569900, 649900, '#e7e2d8', ['摄影', '旅行'], 57),
  product('p-chair', 'm-home', 'cat-home', 'shopping', '人体工学办公椅', '久坐也想舒服一点', '给腰和肩膀一点体面。', 129900, 169900, '#e1eff0', ['办公', '家居'], 92),
  product('p-diffuser', 'm-home', 'cat-home', 'shopping', '无火香薰套装', '把房间变得松弛一点', '下班回家的一点好闻。', 12900, 16900, '#f7e4d5', ['香氛', '家居'], 54),
  product('p-toy-blocks', 'm-home', 'cat-books', 'shopping', '城市积木街景', '拼完像拥有一条街', '周末沉浸感玩具。', 39900, 49900, '#f2e1b8', ['积木', '文娱'], 58),
  product('p-pet-bed', 'm-home', 'cat-home', 'shopping', '云感宠物窝', '小朋友也要睡得舒服', '给毛孩子安排一个角落。', 19900, 25900, '#f1d8c8', ['宠物', '家居'], 61),
  product('p-yoga-mat', 'm-home', 'cat-sport', 'shopping', '防滑瑜伽垫', '伸展、训练、居家都好用', '运动计划从铺开它开始。', 15900, 21900, '#d7efe6', ['瑜伽', '健身'], 66),
  product('p-running-tee', 'm-style', 'cat-fashion', 'shopping', '速干跑步短袖', '轻、透气、好搭配', '晨跑和通勤都能穿。', 13900, 18900, '#d8e7ff', ['运动', '服饰'], 63),
  product('p-burger-classic', 'm-burger', 'cat-takeaway', 'food_delivery', '招牌牛肉汉堡', '厚切牛肉，芝士拉满', '一口下去很有满足感。', 3200, 3900, '#ffd4a3', ['炸鸡汉堡', '热卖'], 95),
  product('p-burger-chicken', 'm-burger', 'cat-takeaway', 'food_delivery', '脆皮鸡腿堡', '外脆里嫩，酱香刚好', '适合快乐加餐。', 2900, 3500, '#ffd4a3', ['炸鸡汉堡', '套餐'], 88),
  product('p-fries', 'm-burger', 'cat-takeaway', 'food_delivery', '海盐薯条', '热乎、酥脆、停不下来', '汉堡旁边永远需要它。', 1500, 1900, '#ffe5a8', ['小食', '炸鸡汉堡'], 70),
  product('p-pizza', 'm-burger', 'cat-takeaway', 'food_delivery', '双拼芝士披萨', '一半肉香，一半清爽', '聚会感一下就来了。', 5200, 6800, '#ffd1b0', ['披萨', '套餐'], 74),
  product('p-cake', 'm-dessert', 'cat-takeaway', 'food_delivery', '伯爵茶奶油蛋糕', '茶香轻盈，不会太甜', '今天值得来一块。', 3600, 4500, '#ffd7ea', ['甜品', '蛋糕'], 82),
  product('p-icecream', 'm-dessert', 'cat-takeaway', 'food_delivery', '开心果冰淇淋杯', '坚果香和奶香很搭', '饭后的小小奖励。', 2600, 3200, '#dff3d1', ['甜品', '下午茶'], 76),
  product('p-bbq-lamb', 'm-bbq', 'cat-takeaway', 'food_delivery', '孜然羊肉串', '香气很足，夜宵刚好', '越晚越想点的味道。', 4200, 5200, '#ffc0a8', ['烧烤', '夜宵'], 90),
  product('p-sushi-set', 'm-sushi', 'cat-takeaway', 'food_delivery', '三文鱼寿司拼盘', '清爽、精致、分量刚好', '想吃轻一点的时候。', 5800, 6800, '#d8f2ff', ['寿司', '轻食'], 71),
  product('p-salad-chicken', 'm-sushi', 'cat-takeaway', 'food_delivery', '低脂鸡胸沙拉', '蔬菜脆、鸡胸嫩', '清爽但不空虚。', 3600, 4200, '#d9f7dc', ['轻食', '健身'], 77),
  product('p-bakery-croissant', 'm-bakery', 'cat-takeaway', 'food_delivery', '黄油可颂套餐', '酥皮香，早餐很稳', '早晨的快乐不复杂。', 2800, 3500, '#ffe5b6', ['早餐', '面包'], 80),
  product('p-coffee-americano', 'm-cafe', 'cat-takeaway', 'food_delivery', '冰美式', '清爽提神，干净利落', '工作日的续航按钮。', 2200, 2600, '#d8ecff', ['咖啡', '下午茶'], 84),
  product('p-coffee-mocha', 'm-cafe', 'cat-takeaway', 'food_delivery', '榛果摩卡', '巧克力香气更浓一点', '甜和苦都刚刚好。', 3000, 3600, '#d8c2ac', ['咖啡', '热卖'], 73),
  product('p-noodle-spicy', 'm-noodle', 'cat-takeaway', 'food_delivery', '红油担担面', '香辣开胃，拌匀更香', '胃口打开得很快。', 3300, 3900, '#ffc3a4', ['面食', '辣味'], 87),
  product('p-noodle-dry', 'm-noodle', 'cat-takeaway', 'food_delivery', '葱油拌面', '葱香浓，面条劲道', '简单但很顶的一碗。', 2400, 3000, '#ffd4be', ['面食', '工作餐'], 72),
  product('p-tea-cheese', 'm-tea', 'cat-takeaway', 'food_delivery', '芝士多肉葡萄', '果肉足，奶盖厚', '下午茶人气款。', 2900, 3500, '#d6f5cc', ['奶茶', '果茶'], 92),
  product('p-tea-boba', 'm-tea', 'cat-takeaway', 'food_delivery', '黑糖珍珠鲜奶', '珍珠软糯，奶香更足', '甜口快乐很直接。', 2600, 3200, '#d6f5cc', ['奶茶', '热卖'], 89),
  product('p-bento-pork', 'm-bento', 'cat-takeaway', 'food_delivery', '梅子烧肉饭', '酸甜开胃，肉香足', '午饭不想纠结就选它。', 4300, 5000, '#cfdcff', ['便当', '午餐'], 83),
  product('p-bento-curry', 'm-bento', 'cat-takeaway', 'food_delivery', '日式咖喱鸡排饭', '咖喱浓，鸡排脆', '一份很稳的工作餐。', 4500, 5200, '#cfdcff', ['便当', '套餐'], 81),
  product('p-burger-nuggets', 'm-burger', 'cat-takeaway', 'food_delivery', '黄金鸡块', '外壳酥脆，蘸酱更香', '加餐小食很合适。', 1800, 2300, '#ffd4a3', ['炸鸡汉堡', '小食'], 68),
  product('p-dessert-tiramisu', 'm-dessert', 'cat-takeaway', 'food_delivery', '提拉米苏盒子', '咖啡香和奶油层层叠叠', '适合给今天加一点甜。', 3300, 4200, '#ffd7ea', ['甜品', '蛋糕'], 78),
  product('p-dessert-mille', 'm-dessert', 'cat-takeaway', 'food_delivery', '草莓千层', '奶油轻，草莓香', '漂亮又好吃的下午茶。', 3800, 4800, '#ffd7ea', ['甜品', '下午茶'], 85),
  product('p-bbq-chicken', 'm-bbq', 'cat-takeaway', 'food_delivery', '蜜汁鸡翅', '表皮焦香，甜咸刚好', '夜宵桌上的主角。', 3600, 4500, '#ffc0a8', ['烧烤', '热卖'], 86),
  product('p-bbq-eggplant', 'm-bbq', 'cat-takeaway', 'food_delivery', '蒜蓉烤茄子', '蒜香浓，软糯入味', '烧烤局必点素菜。', 2200, 2800, '#ffc0a8', ['烧烤', '夜宵'], 75),
  product('p-sushi-eel', 'm-sushi', 'cat-takeaway', 'food_delivery', '鳗鱼手握双拼', '酱香浓郁，米饭软糯', '精致一点的晚餐。', 5200, 6200, '#d8f2ff', ['寿司', '热卖'], 73),
  product('p-bakery-bagel', 'm-bakery', 'cat-takeaway', 'food_delivery', '贝果早餐盒', '贝果、鸡蛋、咖啡都齐了', '把早晨安排得清清楚楚。', 3200, 3900, '#ffe5b6', ['早餐', '轻食'], 79)
]

function merchant(
  id: string,
  name: string,
  type: OrderType,
  color: string,
  tags: string[],
  deliveryMinutes: number,
  minOrderAmount: number,
  deliveryFee: number
) {
  return {
    id,
    name,
    type,
    logoUrl: svgDataUri(name.slice(0, 4), color),
    rating: 4.6 + (deliveryMinutes % 4) / 10,
    deliveryMinutes,
    minOrderAmount,
    deliveryFee,
    tags
  }
}

function product(
  id: string,
  merchantId: string,
  categoryId: string,
  orderType: OrderType,
  title: string,
  subtitle: string,
  description: string,
  virtualPrice: number,
  compareAtPrice: number,
  color: string,
  tags: string[],
  recommendationWeight: number
) {
  return {
    id,
    merchantId,
    categoryId,
    orderType,
    title,
    subtitle,
    description,
    imageUrl: productImages[id] ?? svgDataUri(title, color),
    virtualPrice,
    compareAtPrice,
    virtualStock: 999,
    virtualSalesCount: 1000 + recommendationWeight * 13,
    tags,
    status: 'active',
    recommendationWeight
  }
}

export function id(prefix: string): string {
  return `${prefix}_${nanoid(12)}`
}
