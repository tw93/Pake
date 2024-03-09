/*
 * This file serves as a collection point for external JS and CSS dependencies.
 * It amalgamates these external resources for easier injection into the application.
 * Additionally, you can directly include any script files in this file
 * that you wish to attach to the application.
 */
document.addEventListener('DOMContentLoaded', function()
{
    'use strict';

    console.log('outliner');

    /* 初始化数据*/
    //---------start---------------------

    const olEditor = outliner(); // 初始化outliner, required
    const chatBox = chatter().chatBox; // 初始化chatbox, required
    const chatAgent = chatter(); // 初始化聊天对象
    const chatting = chatAgent.chatting; // stream
    const replying = chatAgent.replying; // no stream, async
    const webStorage = annotationStorage();
    let runScript = false; // 脚本开关
    //--------end----------------------

    /* sidebar 创建 */
    //---------start---------------------

    //// 创建一个侧边栏容器
    const sidebar = document.createElement('div');
    sidebar.classList.add('sidebar_sd');
    // 隐藏sidebar
    sidebar.style.visibility = 'hidden';


    //// 创建outliner面板

    // 容器
    const outlinerPanel = document.createElement('div');
    outlinerPanel.classList.add('outlinerPanel_sd');

    // Make the title fixed at the top of the outlinerPanel
    const titleContainerOutliner = document.createElement('div');
    titleContainerOutliner.classList.add('titleContainerOutliner_sd');
    titleContainerOutliner.textContent = 'Quotations';

    //// draggable
    dragSidebar(titleContainerOutliner);

    function dragSidebar(dom){
        let curX = 0;
        let curY = 0;
        
        // 开始拖拽
        dom.addEventListener('mousedown', e => {
          curX = e.clientX - sidebar.offsetLeft;
          curY = e.clientY - sidebar.offsetTop;
          window.addEventListener('mousemove', mouseMoveHandler);
        });
        
        // 拖拽中
        const mouseMoveHandler = e => {
          sidebar.style.left = e.clientX - curX + 'px';
          sidebar.style.top = e.clientY - curY + 'px';
        };
        
        // 停止拖拽 
        dom.addEventListener('mouseup', () => {
            window.removeEventListener('mousemove', mouseMoveHandler);
        });

    }

    // 点击title复制所有文本条目
    // 同时将数据保存到local storage
    titleContainerOutliner.addEventListener('dblclick', function(event) {
        // 下面的获取有bug，微信公号文章会丢失部分字符串
        //var url = window.location.origin + window.location.pathname;
        var url = window.location.href;
        var title = document.title;
        var linkage = `[${title}](${url})`;

        var sidebarText = '';

        // add linkage
        sidebarText += linkage + '\n';

        // add all items in outliner
        var outlinerText = olEditor.outlineEditor.exportAllItems();
        var tabbedText = outlinerText.split('\n').map(line => '\t' + line).join('\n'); // 行首缩进，并于导出大纲分级
        sidebarText += tabbedText;

        navigator.clipboard.writeText(sidebarText);
        tipOfCopy();

        // 保存页面数据
        webStorage.saveAllAnnotations();
        //console.log('annotations saved.');
    });

    // 添加到sidebar
    document.body.appendChild(sidebar);
    sidebar.appendChild(outlinerPanel);
    outlinerPanel.appendChild(titleContainerOutliner);
    outlinerPanel.appendChild(olEditor);

    // copied 消息提示
    function tipOfCopy(){
        // 创建提示元素
        const tip = document.createElement('div');
        tip.classList.add('tip_sd');
        tip.textContent = 'All quotations copied.';

        // 插入到文档中
        sidebar.appendChild(tip);

        // 1 秒后隐藏提示
        setTimeout(() => {
          tip.style.opacity = '0';
        }, 1000);
    }

    //// 创建chatbox面板
    
    const chatPanel = document.createElement('div');
    chatPanel.style.cssText = `
       display: 'none', 
    `;

    // Make the title fixed at the top of the chatPanel
    const titleContainerChat = document.createElement('div');
    titleContainerChat.classList.add('titleContainerChat_sd');
    titleContainerChat.textContent = 'chat with GPT';

    // dragable
    dragSidebar(titleContainerChat);


    // 添加到sidebar
    sidebar.appendChild(chatPanel);
    chatPanel.appendChild(titleContainerChat);
    chatPanel.appendChild(chatBox);

    // 初始两个panel的显示设置
    outlinerPanel.style.display = 'block'; //block
    chatPanel.style.display = 'none';

    //// 添加一个面板切换的按钮
    const switchButton = document.createElement('button');
    switchButton.classList.add('switchButton_sd');
    switchButton.textContent = 's';

     // Add click event listener to the switch button
     switchButton.addEventListener('click', () => {
         switchBetweenPanels();
     });

    // 切换面板
    let activateChat = false;
    function switchBetweenPanels(){
            if (outlinerPanel.style.display === 'block') {
                outlinerPanel.style.display = 'none';
                chatPanel.style.display = 'block';
                activateChat = true;
                // activate input in chatting
                const chatInput = document.querySelector(".chatInput");
                const chatInputText = chatInput.value;
                chatInput.focus();
                setTimeout(()=>{ //清除多余的s字符
                    chatInput.value = chatInputText;
                }, 100);
            } else {
                outlinerPanel.style.display = 'block';
                chatPanel.style.display = 'none';
                activateChat = false;
            }
    }

    sidebar.appendChild(switchButton);


    //// 添加一个控制sidebar出现的按钮
    const toggleSidebar = document.createElement('button');
    toggleSidebar.classList.add('toggleSidebar_sd');
    toggleSidebar.classList.add('outline_sidebar');
    toggleSidebar.textContent = '+';

    // 添加点击事件监听器
    // 初始化outliner的条目
    // 读取存储数据
    toggleSidebar.addEventListener('click', () => {

        // 先去除longPressed状态
        if (isLongPressed){
            isLongPressed = false;
            return; 
        } 

        toggleSidebar.style.backgroundColor = "#42bbf4";
        sidebar.style.opacity = (sidebar.style.opacity === '0' && runScript) ? '1' : '0';
        sidebar.style.zIndex = (sidebar.style.opacity === '0') ? '-9999' : '9999';
        toggleSidebar.textContent = (sidebar.style.opacity === '0') ? '+' : 'x';
        sidebar.style.visibility = (sidebar.style.opacity === '0') ? 'hidden': 'visible';
        runScript = true;

        // make the first item
        const now = new Date();
        const date = now.toLocaleDateString();
        const time = now.toLocaleTimeString();
        const startTime = `Date: ${date} Time: ${time}`;

        if (olEditor.outlineEditor.children.length === 0) {
            const startItem = document.createElement('li');
            startItem.classList.add('startItem_sd');
            startItem.classList.add('starter');
            startItem.textContent = startTime; // Zero-width space
            //startItem.textContent = '\u200B' + startTime; // Zero-width space
            olEditor.outlineEditor.appendChild(startItem);
            olEditor.outlineEditor.lastActiveNode = startItem;

            // 读取存储数据
            // 进行页面重构
            webStorage.applyAllData();
        }
    });

    // 增加长按关闭运行

    let pressTimer;
    let isLongPressed = false;
    // 鼠标长按关闭运行状态
    toggleSidebar.addEventListener("mousedown", function(e) {
        if (runScript){
            pressTimer = setTimeout(function() {
                isLongPressed = true;
                runScript = false;
                // 关闭显示
                toggleSidebar.style.backgroundColor = "#aaa";
                sidebar.style.opacity == '0';
                sidebar.style.opacity = (sidebar.style.opacity === '0' && runScript) ? '1' : '0';
                sidebar.style.zIndex = (sidebar.style.opacity === '0') ? '-9999' : '9999';
                sidebar.style.visibility = (sidebar.style.opacity === '0') ? 'hidden': 'visible';
                toggleSidebar.textContent = (sidebar.style.opacity === '0') ? '+' : 'x';
            }, 1000); // 设置长按时间阈值（秒）
        }
    });
    
    // 当鼠标松开时，清除定时器
    toggleSidebar.addEventListener('mouseup', function() {
        clearTimeout(pressTimer);
    });


    document.body.appendChild(toggleSidebar);

    /// 划词高亮，点击回溯
    function scrollToHighlight(highlighted){
        highlighted.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function openPageViewer(pageNumber){
        const pageViewer = document.querySelector(`.${pageNumber}`); // 类似.pc2是viewer容器
        pageViewer.classList.add('opened');
    }

    // 划词生成snippet，添加到outliner中
    document.addEventListener('mouseup', function (e) {
        const selectedText = window.getSelection().toString().trim();

        // 检测是否为sidebar中的文字
        // sidebar中的文字不做处理，避免重复添加
        const target = event.target;

        if (selectedText.length > 0 && !sidebar.contains(target) && runScript) {
            // 文章中的高亮与outliner中item，保持一致的datasetIndex
            const equalDataSetIndex = Date.now();
            highlightSelectedText(equalDataSetIndex);

            // 侦听高亮取消事件
            // 获得本次高亮之后的所有node
            const newlyHighlighted = document.querySelectorAll(`.highlighted[data-index="${equalDataSetIndex}"]`);
            newlyHighlighted.forEach(node => {
                node.addEventListener('mousedown', (e) => {
                    setTimeout(() =>{
                        removeHighlighted(node)
                    },500);
                });
            });

            // 创建一个新的snippet
            // 调用outliner自身的创建方法
            olEditor.outlineEditor.appendNewItem(selectedText, 'snippet', equalDataSetIndex);
            //console.log('add snippet to outline');

            // 侦听这个新建snippet的单击侦听
            const newAddedSnippet = document.querySelector(`.snippet[data-index="${equalDataSetIndex}"]`);
            newAddedSnippet.classList.add('newAddedSnippet_sd'); // outliner.js 修改重置item的bug

             
            let pressTimer;
            let isLongPressed = false;

            // 点击跳转
            newAddedSnippet.addEventListener('click', (e) => {
                e.stopPropagation(); // 防止事件冒泡
                // 先去除longPressed状态
                if (isLongPressed){
                    isLongPressed = false;
                    return; 
                } 

                const highlighted = document.querySelector(`.highlighted[data-index="${newAddedSnippet.dataset.index}"]`);
                if (highlighted) {
                    scrollToHighlight(highlighted); // 兼容pdf2html
                    //highlighted.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });

            // 长按消除本snippet和对应的高亮
            newAddedSnippet.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // 防止事件冒泡
                pressTimer = setTimeout(()=>{
                    isLongPressed = true;
                    newlyHighlighted.forEach(node => {
                        removeHighlighted(node);
                    });
                    //console.log('remove all.');
                }, 1000);
            });

            // 当鼠标松开时，清除定时器
            newAddedSnippet.addEventListener('mouseup', function() {
                clearTimeout(pressTimer);
            });

            // 清除选区，避免重复添加
            window.getSelection().removeAllRanges();
            // 滚动到最后
            //sidebar.scrollTop = sidebar.scrollHeight;

            // 自动保存在这里实现
            // 鼠标弹起后300毫秒
            const timeGap = 300; 
            delaySave(timeGap);
        }

        // chatbox中的文字处理
        if (selectedText.length > 0 && chatBox.contains(target) && runScript) {
            const dataSetIndex = Date.now();
            olEditor.outlineEditor.appendNewItem(selectedText, 'chatItem', dataSetIndex);
            tipOfTransferData(target);
        }
    });


    // esc键处理取消选择的情况
    function handleKeyDown(event) {
        if (event.key === 'Escape') {
            // 清除鼠标选择文本
            window.getSelection().removeAllRanges();
        }

    }
    document.addEventListener('keydown', handleKeyDown);


    /// 高亮相关的函数方法
    // 高亮选区
    function highlightSelectedText(equalDataSetIndex) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            // 通过先extract
            // 得到的是一个DocumentFragment
            const content = range.extractContents();
            //console.log('extracted: ', getNodesFromFragment(content));


            // 递归解决其中的textNode
            // 不再简单用<span>包裹
            const highlighted = highlightExtracted(content, equalDataSetIndex);
            //console.log('highlighted: ', getNodesFromFragment(highlighted));

            // 跨node需要合并的highlighted
            // 特征：并非 .highlighted
            // highlighted元素大于等于2个
            // 此处或有考虑不全，有漏洞
            // 使用临时的mergUp，mergDown进行标识
            if (highlighted.childNodes.length >=2){
                const len = highlighted.childNodes.length
                const headNode = highlighted.childNodes[0];
                const tailNode = highlighted.childNodes[len-1];
                if(!headNode.classList.contains('highlighted') && !tailNode.classList.contains('highlighted')){
                    headNode.classList.add('mergUp');
                    tailNode.classList.add('mergDown');
                    //console.log('merge: ', getNodesFromFragment(highlighted));
                }
            }

            // 高亮后的DocumentFragment重新插入到文档
            range.insertNode(highlighted);

            // 重新提取mergup和mergdown
            // 进行兄弟节点合并
            const mergUp = document.querySelector('.mergUp');
            if (mergUp){
                const mergUpTag = mergUp.tagName;
                const previousNode = mergUp.previousElementSibling;
                let previousNodeTag = '';
                if (previousNode){
                    previousNodeTag = previousNode.tagName;
                }
                if (mergUpTag === previousNodeTag){ // 做一次判断，保证是同一个<tag>被extracted
                    while (mergUp.firstChild) {
                        previousNode.appendChild(mergUp.firstChild);
                    }
                }
                mergUp.classList.remove('mergUp');
            }

            const mergDown = document.querySelector('.mergDown');
            if (mergDown){
                const mergDownTag = mergDown.tagName;
                const nextNode = mergDown.nextElementSibling;

                let nextNodeTag = '';
                if (nextNode){
                    nextNodeTag = nextNode.tagName;
                }
                if (mergDownTag === nextNodeTag){ // 做一次判断，保证是同一个<tag>被extracted
                    while (nextNode.firstChild) {
                        mergDown.appendChild(nextNode.firstChild);
                    }

                    //console.log('mergDown', mergDown);
                }
                mergDown.classList.remove('mergDown');
            }

            // 重新选中先前选中的文本
            //selection.removeAllRanges();
            //selection.addRange(range);
        }
    }

    function highlightExtracted(content, equalDataSetIndex) {
        for (let node of content.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                // 构造高亮span
                const span = document.createElement('span');
                span.style.backgroundColor = 'yellow';
                span.className = 'highlighted';
                span.dataset.index = equalDataSetIndex;
                span.textContent = node.nodeValue;
                // 当前node替换成span
                node.replaceWith(span);
            } else {
                highlightExtracted(node, equalDataSetIndex);
            }
        }
        // 返回的还是一个content，extract content
        return content
    }

    // 取消高亮
    function removeHighlighted(highlightedNode){
        const pNode = highlightedNode.parentNode;
        if(pNode){
            pNode.insertBefore(document.createTextNode(highlightedNode.innerText), highlightedNode);
            pNode.removeChild(highlightedNode);
            //console.log('remove highlight.');
        }
    }

    /// 段落选择
    function selectParapgraphs(){
        // identify paragraph, checkbox attached
        let targetElement = null;
        let hoverElement = null;
        let parentElement = null;
        let allParagraphs = [];
        let checkedBoxes = [];
        let selectedParagraphs = [];


        document.addEventListener('mouseover', event => {
            // 鼠标移入,添加红色边框
            // 如果没有选择的元素
            if (event.altKey) {
                if (!allParagraphs.includes(event.target)) {
                    hoverElement = event.target;
                    hoverElement.style.border = '1px solid red';

                    // 将侦听事件移入 hoverElement
                    hoverElement.addEventListener('click', event => {
                        // 点击蓝色边框
                        if (hoverElement) {
                            targetElement = event.target;
                            targetElement.style.border = '';

                            //console.log('target element is :', targetElement);

                            // 获取parent
                            parentElement = targetElement.parentElement;
                            // 获得所有的paragraph
                            allParagraphs.push(...parentElement.childNodes);
                            //console.log(allParagraphs);

                            selectablePs(allParagraphs, 20);
                        }
                    });

                }
            }
        });

        document.addEventListener('mouseout', event => {
            // 鼠标移出,清除红色边框
            hoverElement = event.target;
            //if (allParagraphs.length ==0) {
                hoverElement.style.border = '';
                hoverElement = null;
            //}
        });

        function selectablePs(paragraphs, cc = 30) {
            function checkData(checkbox, p){
                /* checked for data change */

                // 根据复选框状态添加或移除段落
                if (checkbox.checked) {
                    selectedParagraphs.push(p);
                    checkedBoxes.push(checkbox);
                } else {
                    const index = selectedParagraphs.indexOf(p);
                    if (index !== -1) {
                        selectedParagraphs.splice(index, 1);
                    }

                    const index_cb = checkedBoxes.indexOf(checkbox);
                    if (index_cb !== -1) {
                        checkedBoxes.splice(index_cb, 1);
                    }
                }
            }

            paragraphs.forEach((p) => {

                // 打个补丁，部分p可能是text，并没有tagName
                if (!p.firstChild) return;

                // check 是否已经有勾选框
                if (p.firstChild.tagName === 'INPUT' && p.firstChild.type === 'checkbox') {
                    return; 
                }

                // Check 字数
                if (p.textContent.length > cc) {
                    //p.style.border = '1px solid blue';
        
                    // 创建勾选按钮
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.style.opacity = 0.3;
                    p.insertBefore(checkbox, p.firstChild);

                    // 监听 勾选 事件
                    checkbox.addEventListener('click', (event) => {
                        checkData(checkbox,p);
                    });

                    /// option + 单击
                    p.addEventListener('click', (event) => {
                        if (event.altKey){
                            checkbox.checked = !checkbox.checked;
                            checkData(checkbox,p);
                        }
                    });
        
                    // 监听 鼠标双击 事件
                    //p.addEventListener('dblclick', (event) => { //'dblclick'
                    //    checkbox.checked = !checkbox.checked;
                    //    checkData(checkbox,p);
                    //});

                    /// option + 长按触发
                    //let pressTimer;

                    // 鼠标按下事件监听器
                    //p.addEventListener('mousedown', () => {
                    //    if (event.altKey) {
                    //        // 设置一个计时器，在一定时间后触发长按事件
                    //        pressTimer = setTimeout(() => {
                    //            checkbox.checked = !checkbox.checked;
                    //            checkData(checkbox,p);
                    //        }, 400);
                    //    }
                    //});
                    //
                    //// 鼠标释放事件监听器
                    //p.addEventListener('mouseup', () => {
                    //  // 清除计时器，以防止触发长按事件
                    //  clearTimeout(pressTimer);
                    //});
                    //
                    //// 如果鼠标移开了元素，也清除计时器
                    //p.addEventListener('mouseout', () => {
                    //  clearTimeout(pressTimer);
                    //});

                }
            });
        }

        document.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && selectedParagraphs.length > 0) {
                let contents = '';
                selectedParagraphs.forEach((p)=>{
                    contents += p.textContent;
                });

                queryPipe(contents);

                // 保存状态数据
                lastContents = contents;
            }
        });

        // 长按最后一次response的内容，重新发送
        let pressTimer;
        document.addEventListener('mousedown', (event) => {
            const target = event.target;
            if(target === lastResponseItem){
                pressTimer = setTimeout(() => {
                    //console.log('ready to re-send.');
                    target.style.opacity = 0.7;
                    target.innerHTML = 'requery...'
                    reQueryPipe();
                },1000);
            }
        });

        document.addEventListener('mouseup', (event) => {
            clearTimeout(pressTimer);
        });

        // 为了重新发送最后一次问询
        let lastContents = '';
        let lastSelectedPs = [];
        let lastResponseItem = null;

        async function queryPipe(contents){
            /* 这里处理各种LLM应用, 用异步控制次序 */

            // 新建生成摘要dom元素
            const responseItem = document.createElement('div');
            responseItem.classList.add("inContentChat");

            // 保存当前状态数据
            lastSelectedPs = selectedParagraphs;
            lastResponseItem = responseItem;
            
            if (parentElement){ // 在选中的段落列比最后新增一个
                const endP = selectedParagraphs[selectedParagraphs.length-1];
                parentElement.insertBefore(responseItem, endP.nextSibling);
            }

            // 总结
            let pmpSummary = '';
            //pmpSummary += pmpTags;
            pmpSummary += pmpMain;
            pmpSummary += contents;
            await summaryInContent(pmpSummary,responseItem);


            // 提取关键字
            let pmpKWs = '';
            pmpKWs += pmpKeyWords;
            pmpKWs += contents;

            // catch error and show in responseItem
            try{
                await highlightInContent(pmpKWs, selectedParagraphs);
            }catch(error){
                responseItem.innerHTML = 'Simple Fetch error: ' + error.message;
            }
            
            // 清除状态
            selectedParagraphs = [];
            checkedBoxes.forEach((checkbox) => {
                checkbox.checked = false;
            });
            checkedBoxes = [];
        }

        async function reQueryPipe(){
            // 总结
            let pmpSummary = '';
            pmpSummary += pmpMain;
            pmpSummary += lastContents;
            await summaryInContent(pmpSummary,lastResponseItem);

            // 提取关键字
            let pmpKWs = '';
            pmpKWs += pmpKeyWords;
            pmpKWs += lastContents;

            try{
                await highlightInContent(pmpKWs, selectedParagraphs);
            }catch(error){
                lastResponseItem.innerHTML = 'Simple Fetch error: ' + error.message;
            }
            //await highlightInContent(pmpKWs, lastSelectedPs);
        }


    }


    /// LLMs应用
    //const pmpMain = "用通俗简明的语言概括下面内容，解释其中理解起来困难的地方。用中文回复。"
    const pmpMain = "用通俗简明的语言概括下面内容，字数控制在30字以内。用中文回复。"

    const pmpKeyWords = `
        我的兴趣所在是LLM辅助下人类的认知如何提升。根据我的这个兴趣点，请帮我从下文中中摘录出不多于10个的关键词,以JSON格式输出，输出格式：
        {"keywords_in_raw":["keyword1","keyword2",...]}
    `;

    const pmpTags = `
    请从下面这段文字中,提取出能够代表文本主题的关键词或词组作为标签。这些标签应该能够概括文章的核心内容,是进行文本主题分类的有效特征。请提取齐全且准确的标签,每个标签应该是文本的核心关键词或词组,不要提取无关词语。希望您能提取出足够具有区分度的标签,以用于文本分类、搜索引擎关键词匹配、知识管理与个性化推荐。请用英文逗号分隔每个标签,输出这些精简但充分的标签。补充说明:所提取的标签应该能够概括表达文本的主要内容,而不是文本中的某些细节或无关词语。输出的标签的语言为中文。
    `;

    async function highlightInContent(promptText,elements){
        // 清空历史聊天
        chatAgent.clearChatHistory();

        // 使用非流式获取json
        // 并且提取回复中的关键词
        try {
            const reply = await replying(promptText);
            //console.log(reply);

            const keywords = extractKeywords(reply);
            //console.log(keywords);

            highlightKeywordsInDom(keywords, elements);
        } catch(error){
            //console.error("Fetch error: ", error);
            throw error;
        }
    }

    async function summaryInContent(promptText,responseItem){
        // 清空历史聊天
        chatAgent.clearChatHistory();

        // 使用流式获取内容摘要
        await chatting(promptText, responseItem);
    }

    function extractKeywords(text){
        
        // 使用正则表达式提取keywords_in_raw的值
        const regex = /"keywords_in_raw":\s*\[([^\]]+)\]/;
        const match = text.match(regex);
        
        if (match && match[1]) {
            const extractedKeywords = JSON.parse(`{ "keywords_in_raw": [${match[1]}] }`);
            //console.log(extractedKeywords);

            return extractedKeywords['keywords_in_raw']
        } else {
            console.error('未找到匹配的关键词数据');
        }
    }

    function highlightKeywordsInDom(keywords, elements) {
        elements.forEach(element => {
            let elementHTML = element.innerHTML;
    
            keywords.forEach(keyword => {
                const regex = new RegExp(keyword, 'gi');
                let match;
                
                while ((match = regex.exec(elementHTML)) !== null) {
                    elementHTML = elementHTML.substring(0, match.index) +
                        `<span style="background-color: #00c7ff26">${match[0]}</span>` +
                        elementHTML.substring(match.index + match[0].length);
                    break; // 只处理第一个匹配
                }
            });
    
            element.innerHTML = elementHTML;
        });
    }

    //selectMultiP(); // 这个上下选择暂时屏蔽以便试验新的交互
    // 使用新的选择段落逻辑
    selectParapgraphs()

    //// 数据存储于local storage
    function annotationStorage() {
        //console.log('storage pra');
        //
        const webStorage = {};
      
        const storageKey = 'highlightedData_' + window.location.href;
        const savedHighlightData = localStorage.getItem(storageKey);
        //console.log(savedOutlinerData);
      
        // 重新恢复页面
        // 包含outliner与页面高亮
        webStorage.applyAllData = function() {
            //console.log('loading data...');

            // 读取，并重新形成outliner
            olEditor.outlineEditor.restoreData();

            // 读取，并重新高亮
            if (savedHighlightData) {
                const parsedData = JSON.parse(savedHighlightData);
                parsedData.forEach((entry) => {
                    const dataIndex = entry.dataset_index;
                    const snippet = document.querySelector(`.newAddedSnippet_sd[data-index="${dataIndex}"]`);
                    //console.log(snippet);

                    // 只高亮outliner中对应的内容
                    if(snippet){
                        //console.log(entry);
                        applyHighlight(entry);
                    }else{
                        // clear this entry
                        // bug:有丢失item的现象，todo
                        //const storageKey = 'highlightedData_' + window.location.href;
                        //localStorage.removeItem(storageKey, JSON.stringify(entry));
                    }
                });
                //console.log('apply all highlighted.');
            }

            // 遍历所有snippet，增加跳转到原文高亮的侦听
            const snippets = Array.from(olEditor.outlineEditor.querySelectorAll('li')).filter(item => item.classList.contains('snippet'));
            snippets.forEach(snippet => {
                snippet.addEventListener('click', (e) => {
                    e.stopPropagation(); // 防止事件冒泡
                    const highlighted = document.querySelector(`.highlighted[data-index="${snippet.dataset.index}"]`);
                    //console.log('restored highlight is:', highlighted);
                    if (highlighted) {
                        scrollToHighlight(highlighted);
                    }
                });
            });


            //console.log('apply outliner.');
        }
      
        // 异步存储数据
        webStorage.saveAllAnnotations = async function() {

            const highlightedSpans = document.querySelectorAll('.highlighted');
            const data = Array.from(highlightedSpans).map((span) => {
                return {
                    xpath: getXPath(span.parentNode),
                    text: span.textContent,
                    dataset_index: span.dataset.index,
                    textPosition: getTextPosition(span), //`${startIndex}-${endIndex}`
                    textQuotation: getTextQuote(span) //32-text-32, 前后32个字符
                };
            });

            // 使用当前页面的 URL 作为存储键
            const storageKey = 'highlightedData_' + window.location.href;

            // 使用 Promise 包装 localStorage 的异步写入操作
            const saveDataPromise = new Promise((resolve, reject) => {
                try {
                    localStorage.setItem(storageKey, JSON.stringify(data));
                    resolve(); // 必须有
                    //resolve('highlighted saved!!');
                } catch (error) {
                    reject(error);
                }
            });
        
            try {
                // 等待 localStorage 操作完成
                const result = await saveDataPromise;
                //console.log(result); //null?
        
                // 调用outliner中的数据保存方法，也可以使用异步方式
                await olEditor.outlineEditor.saveData();
                //olEditor.outlineEditor.saveData();
                //console.log('outliner saved!!');
            } catch (error) {
                console.error(error);
            }
        }
      
        function getXPath(element) {
            if (element.id !== '') {
              return 'id("' + element.id + '")';
            }
            if (element === document.body) {
              return element.tagName.toLowerCase();
            }
      
            let siblingIndex = 1;
            let sibling = element;
            while ((sibling = sibling.previousElementSibling)) {
                // 改进，只计算相同tag的兄弟节点
                if (sibling.tagName === element.tagName) {
                  siblingIndex++;
                }
              //siblingIndex++;
            }
      
            return (
              getXPath(element.parentNode) +
              '/' +
              element.tagName.toLowerCase() +
              '[' +
              siblingIndex +
              ']'
            );
        }

        // 获得body中的text位置
        function getTextPosition(element) {
            const text = element.textContent;
            const allText = document.body.innerText;
            const startIndex = allText.indexOf(text);
            const endIndex = startIndex + text.length - 1;
            return `${startIndex}-${endIndex}`;
        }

        // 获得前后32个字符
        function getTextQuote(element) {
            const text = element.textContent;
            const allText = document.body.innerText;
            const start = allText.substring(Math.max(0, allText.indexOf(text) - 32), allText.indexOf(text));
            const end = allText.substring(allText.indexOf(text) + text.length, Math.min(allText.length, allText.indexOf(text) + text.length + 32));
            return `${start}|${text}|${end}`;
        }

        function applyHighlight(entry) {
            //console.log('text: ', entry.text);
            //console.log('xpath: ', entry.xpath);
            //console.log('start-end: ', entry.textPosition);
            //console.log('quotations: ', entry.textQuotation);
            //console.log(' ------------------------------')

            let parent = null;

            // get parent by xpath
            function findByXpath(xpath){
                const foundNode =  document.evaluate(
                    xpath,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;
                if (foundNode) return foundNode;
                return null;
            }

            // get parent by textPostion
            function findByPosition(textPosition,text) {
                let [start, end] = textPosition.split('-');
                start = parseInt(start);
                const allText = document.body.innerText;

                // 先找到包含text的节点
                const textNodes = findSmallestNodeWithText(document.body, text);
                for (let textNode of textNodes) {
                    const nodeText = textNode.textContent;
                    const nodeTextIndex = allText.indexOf(nodeText); // node在全文中index
                    //console.log("node index: ", nodeTextIndex);
                    const inNodeIndex = nodeText.indexOf(text); // 查找到text在本node中的text
                    //console.log("text index: ",inNodeIndex);
                    const offIndex = nodeTextIndex + inNodeIndex;
                    //console.log("start index: ", start);
                    if(start === offIndex){
                        return textNode.parentNode;
                    }
                }
                return null;
            }

            // get parent by textQuotation
            function findByQuotation(textQuote) {
                const [start, text, end] = textQuote.split('|');
                //console.log([start, text, end]);
                const allText = document.body.innerText;

                  // 先找到包含text的节点
                const textNodes = findSmallestNodeWithText(document.body, text);
                
                for (let textNode of textNodes) {

                    const elText = textNode.textContent;
                    // 只截取包含text部分  
                    const startIndex = elText.indexOf(text);
                    const endIndex = startIndex + text.length;
                    const elTextExtract = elText.substring(startIndex, endIndex);
            
                    // 调整开始和结束文本的截取位置
                    const elTextStart = allText.substring(allText.indexOf(elTextExtract) - start.length, allText.indexOf(elTextExtract));
                    const elTextEnd = allText.substring(allText.indexOf(elTextExtract) + elTextExtract.length, allText.indexOf(elTextExtract) + elTextExtract.length + end.length);

                    //console.log(elTextStart);
                    //console.log(elTextEnd);
            
                    // 对比文本
                    if (elTextStart === start && elTextEnd === end) {
                        //console.log(textNode);
                        return textNode.parentNode;
                    }
                }
                return null;
            }

            // 找到最小节点
            function findSmallestNodeWithText(rootNode, searchText) {
                let smallestNodes = [];
              
                function traverse(node) {
                  // 检查节点的文本内容是否包含指定文本
                  if (node.nodeType === Node.TEXT_NODE && node.textContent.includes(searchText)) {
                    // 如果找到包含指定文本的文本节点
                    smallestNodes.push(node);
                  }
              
                  // 递归遍历子节点
                  for (let childNode of node.childNodes) {
                    traverse(childNode);
                  }
                }
              
                // 开始遍历
                traverse(rootNode);
              
                return smallestNodes;
            }


            // pipeline of finding:
            //  xpath > quotation > position 跨node高亮之后，会改变xpath
            //  quotation > xpath > position 先改成这个流程，也有bug
            if (!parent){
                parent = findByQuotation(entry.textQuotation); 
                //console.log("parent by quotation:", parent);
            }
            if (!parent){
                parent = findByXpath(entry.xpath);
                //console.log("parent by xpath:", parent);
            }
            if(!parent){
                parent = findByPosition(entry.textPosition, entry.text);
                //console.log("parent by position:", parent);
            }

            //console.log("parent is:", parent);

            if (!parent) return;
      
            const textNodeIndex = Array.from(parent.childNodes).findIndex(
              (node) => node.nodeType === Node.TEXT_NODE && node.textContent.includes(entry.text)
            );
            if (textNodeIndex === -1) return;
      
            const textNode = parent.childNodes[textNodeIndex];
            const highlightedSpan = document.createElement('span');
            highlightedSpan.className = 'highlighted';
            highlightedSpan.style.backgroundColor = 'yellow'; // maybe set as parameter
            highlightedSpan.textContent = entry.text;
            highlightedSpan.dataset.index = entry.dataset_index;
      
            const text = textNode.textContent;
            const textBefore = text.substring(0, text.indexOf(entry.text));
            const textAfter = text.substring(textBefore.length + entry.text.length);
      
            if (textBefore) {
              parent.insertBefore(document.createTextNode(textBefore), textNode);
            }
            parent.insertBefore(highlightedSpan, textNode);
            if (textAfter) {
              parent.insertBefore(document.createTextNode(textAfter), textNode);
            }
            parent.removeChild(textNode);
        }
      
        return webStorage
    }


    function autoSaveByWatcher(targetNode){
        // 回调函数，当监控行为观察到变化时执行
        const callback_save = function(mutationsList, observer) {
            webStorage.saveAllAnnotations();
            //console.log('save all data to local storage.');
        };
        
        // 观察器的配置（需要观察哪些变动）
        const config_change = {
            //attributes: true,
            childList: true,
            subtree: true
        };
        
        // 创建一个观察器实例并传入回调函数
        const observer_save = new MutationObserver(callback_save);
        
        // 用配置文件开始观察目标节点
        // tmp, 暂时屏蔽对于节点的观察
        //observer_save.observe(targetNode, config_change);
        
        // 添加一个 blur 事件侦听器，用于在焦点离开时自动保存
        const onBlur = function (event) {
            webStorage.saveAllAnnotations();
            //console.log('save all data to local storage on blur.');
        };
        targetNode.addEventListener('blur', onBlur, true);

        // 之后，你可以使用下面的代码停止观察
        // observer.disconnect();
    }
    const targetNode = outlinerPanel; // 监控sidebar中的元素变化，进行存储
    //const highlightGroup = document.querySelectorAll('');
    autoSaveByWatcher(targetNode);

    // 间隔保存
    function autoSave(timeGap) {
        setInterval(function() {
            webStorage.saveAllAnnotations();
            console.log('auto saved');
        }, timeGap);
    }

    const timeGap = 2*60*1000; //2分钟保存一次
    //autoSave(timeGap);

    // 延迟保存
    function delaySave(timeGap){
        setTimeout(function() {
            webStorage.saveAllAnnotations();
            //console.log('auto saved delayed.');
        }, timeGap);
    }


    /// 数据在面板之间互通

    // sidebar作为侦听器
    // 长按数据互通 改
    // 双击互通
    sidebar.addEventListener('dblclick', (event) => {
        const target = event.target;
        const targetText = target.textContent.replace(/\u200B/g, ''); //remove ultra 200b 
        if (target.classList.contains("inner-item") || 
            target.classList.contains("chatItem")    ||
            target.classList.contains("snippet")
        ){
            outlinerToChatInput(targetText);
            tipOfTransferData(target);
            // save to clipboard
            navigator.clipboard.writeText(targetText);
        } else if(target.classList.contains('userLog') ||
            target.classList.contains('botLog')
        ){
            chatlogToOutliner(targetText);
            tipOfTransferData(target);
            navigator.clipboard.writeText(targetText);
        }
        else{
            //console.log('not for processing');
        }
    });

    /* 长按
    sidebar.addEventListener('mousedown', (event) => {
        const insertTimeout = setTimeout(() => {
            //console.log('long press');
            const target = event.target;
            const targetText = target.textContent;
            if (target.classList.contains("inner-item") || 
                target.classList.contains("chatItem")    ||
                target.classList.contains("snippet")
            ){
                outlinerToChatInput(targetText);
                tipOfTransferData(target);
                // save to clipboard
                navigator.clipboard.writeText(targetText);
            } else if(target.classList.contains('userLog') ||
                target.classList.contains('botLog')
            ){
                chatlogToOutliner(targetText);
                tipOfTransferData(target);
                navigator.clipboard.writeText(targetText);
            }
            else{
                //console.log('not for processing');
            }
        }, 500); // 1000ms 长按时间

        // 鼠标松开时清除定时器，避免误触发
        sidebar.addEventListener('mouseup', () => {
            clearTimeout(insertTimeout);
        });

        sidebar.addEventListener('mouseleave', () => {
            clearTimeout(insertTimeout);
        });
    });*/

    //// 几个处理函数
    function chatlogToOutliner(targetText){
        /*将聊天记录发送到outliner作为一个item*/
        const dataSetIndex = Date.now();
        olEditor.outlineEditor.appendNewItem(targetText, 'chatItem', dataSetIndex);
    }

    function outlinerToChatInput(targetText){
        /* 将outliner中的item，发送到聊天输入框*/
        const chatInput = document.querySelector('.chatInput');
        const currentText = chatInput.value;
        const newText = currentText + ' ' + targetText;
        chatInput.value = newText;
    }

    function tipOfTransferData(target){
        // Animate 
        var opacity = 0;
        var interval = setInterval(function(){
            opacity += 0.1;
            target.style.opacity = opacity;
            if(opacity >= 1){
                clearInterval(interval);
            }
        }, 100);
    }


    //// key handler for shortcuts    
    
    class KeyHandler {
      constructor() {
        this.keyDown = {};
        this.lastKey = null;
        this.lastKeyDownTime = null;
        this.leaderKeyDown = false;
        this.leaderKey = [];
        this.keyHistory = [];
    
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
      }
    
      handleKeyDown(e) {
        this.keyDown[e.key] = true;
    
        if (this.leaderKeyDown) {
          this.checkLeaderFollowKey(e.key);
        }
      }
    
      handleKeyUp(e) {
        this.keyDown[e.key] = false;
      }
    
      singleKey(key, callback) {
        document.addEventListener('keydown', (e) => {
          if (e.key === key) {
            callback();
            //console.log(this.keyDown);
          }
        });
      }
    
      combinationKey(keys, callback) {
        document.addEventListener('keydown', (e) => {
          const allKeysPressed = keys.every((key) => this.keyDown[key]);
          if (allKeysPressed) {
            callback();
            //console.log(this.keyDown);
          }
        });
      }
    
      doubleKey(key, interval, callback) {
        document.addEventListener('keydown', (e) => {
          if (e.key === key) {
            const currentTime = new Date().getTime();
            if (this.lastKey === key && currentTime - this.lastKeyDownTime < interval) {
              callback();
            }
            this.lastKey = key;
            this.lastKeyDownTime = currentTime;
          }
        });
      }

      tripleKey(key, interval, callback) {
        document.addEventListener('keydown', (e) => {
          if (e.key === key) {
            const currentTime = new Date().getTime();
            this.keyHistory.push({ key: e.key, time: currentTime });
            // 只保留最近三次按键记录
            if (this.keyHistory.length > 3) {
              this.keyHistory.shift();
            }
            if (
              this.keyHistory.length === 3 &&
              this.keyHistory[0].key === key &&
              this.keyHistory[1].key === key &&
              this.keyHistory[2].key === key &&
              currentTime - this.keyHistory[0].time < interval
            ) {
              callback();
            }
          }
        });
      }
    
      comboKey(leaderKeys, followKey, callback) {
        this.leaderKey = leaderKeys;
        document.addEventListener('keydown', (e) => {
          const allKeysPressed = leaderKeys.every((key) => this.keyDown[key]);
          if (allKeysPressed) {
            this.leaderKeyDown = true;
          }
        });
    
        this.checkLeaderFollowKey = (key) => {
          if (key === followKey) {
            callback();
          }
          this.leaderKeyDown = false;
        };
      }

    }

    const keyHandler = new KeyHandler();

    // 快捷开启sidebar
    // 第一次需要手动点击toggle button
    keyHandler.combinationKey(['Control', 'Enter'], toggleButtonClick);
    function toggleButtonClick(){
        if (document.activeElement.nodeName === 'BODY'){
            toggleSidebar.click();
        }
    }

    // 双击s，切换面板
    keyHandler.doubleKey('s', 200, switchBetweenPanelsByss); 
    function switchBetweenPanelsByss(){
        if (document.activeElement.nodeName === 'BODY'){
            switchBetweenPanels();
        }
    }

    // 三击space，进行inline chat
    keyHandler.tripleKey(' ', 1000, inlineChat);
    function inlineChat(){
        const activeItem = olEditor.outlineEditor.getActiveItem();
        if (activeItem){
            let promptText = activeItem.textContent;
            promptText = promptText.replace(/\u200B/g, '').trimStart();
            //console.log(promptText);

            // check 是否是？？| ?? 开头
            //  这里容易导致过度计算
            //  暂时屏蔽check
            //if (/^(\?\?|\？\？)/.test(promptText)) {
            //}
            const previousItem = activeItem.previousElementSibling;
            if(previousItem){
                const previousContext = previousItem.textContent;
                promptText += previousContext;
            }
            // add new child item to receive response
            //console.log('matched, sending query.');
            const responseItem = olEditor.outlineEditor.createNewChildItem("");

            // chat with
            chatAgent.clearChatHistory();
            chatting(promptText, responseItem);

            } else {
              console.log('no activated item');
            }
    }


    // 快速进入chat输入
    // 有bug
    //keyHandler.doubleKey('i', 200, focusChatInput); 
    //keyHandler.singleKey('i', focusChatInput); 
    //keyHandler.combinationKey(['Control', 'a'], focusChatInput);

    function focusChatInput(){
        //console.log(activateChat);
        if(activateChat){
            const chatInput = document.querySelector(".chatInput");
            chatInput.focus();
            setTimeout(()=>{ //清除多余的s字符
                chatInput.value = '';
            }, 100);
            //console.log('on chatting');
            chatInput.focus();
        }
    }

    // Watch for DOM changes
    const dom_observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.target === document.body) {
                //console.log('dom changed');
                // 如果被清除就加载
                if(document.body.querySelector('.outline_sidebar') == null){
                    document.body.appendChild(sidebar);
                    document.body.appendChild(toggleSidebar);
                }
            }
        });
    });
    
    // Start observing
    dom_observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})
function outliner() {
    //console.log('shift enter');

    // Track the Shift key state
    let shiftKeyPressed = false;

    // Add keydown event listener to track Shift key state
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') {
            shiftKeyPressed = true;
        }
    });

    // Add keyup event listener to track Shift key state
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
            shiftKeyPressed = false;
        }
    });

    // Create the outline editor container
    const editorContainer = document.createElement('div');
    editorContainer.classList.add('outliner-container');

    // Create the outline editor
    const outlineEditor = document.createElement('ul');
    outlineEditor.classList.add('outlineEditor_sd');
    outlineEditor.contentEditable = 'true';
    //outlineEditor.style.margin = '10px';
    //outlineEditor.style.height = 'calc(100% - 20px)';
    //outlineEditor.style.overflow = 'auto';
    //outlineEditor.style.paddingLeft = '0px'; // Remove padding for the main list

    // Add an empty list item when the editor is focused
    outlineEditor.addEventListener('focus', () => {
        if (outlineEditor.children.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = '\u200B'; // Zero-width space
            outlineEditor.appendChild(emptyItem);
        }
    });

    // Add a lastActiveNode property to the outlineEditor element
    outlineEditor.lastActiveNode = null;

    // 设置新增item之后的滚动
    function scrollCenter(newItem){
        // 计算滚动的位置，使新增的 item 处于可视区域的中心
        const containerHeight = outlineEditor.clientHeight;
        const newItemOffsetTop = newItem.offsetTop;
        const newItemHeight = newItem.offsetHeight;
        const scrollPosition = newItemOffsetTop - (containerHeight / 2) + (newItemHeight / 2);
        
        // 设置滚动条位置
        outlineEditor.scrollTop = scrollPosition;
    }

    // Add a createNewItem method to the outlineEditor element
    // to be used in outliner edit inside
    // 此处代码有冗余，todo
    outlineEditor.createNewItem = function (itemText, itemClass='inner-item', itemDataSetIndex=Date.now()) {
        const sel = window.getSelection();

        // 如果outlineEditor不在focus
        // 则取lastActiveNode
        //console.log("1 last active node is: ",outlineEditor.lastActiveNode);

        const liNode = document.activeElement === outlineEditor ? getClosestLiElement(sel.getRangeAt(0).startContainer) : outlineEditor.lastActiveNode;


        if (liNode && liNode.tagName === 'LI') {
            const newItem = document.createElement('li');

            newItem.textContent = '\u200B' + itemText; // Zero-width space
            newItem.classList.add(itemClass);
            newItem.dataset.index = itemDataSetIndex;

            liNode.parentNode.insertBefore(newItem, liNode.nextSibling);
            const newRange = document.createRange();
            newRange.setStart(newItem.firstChild, 1);
            newRange.setEnd(newItem.firstChild, 1);
            sel.removeAllRanges();
            sel.addRange(newRange);
            outlineEditor.lastActiveNode = newItem; // 更新lastActiveNode
            //console.log("2 last active node is: ",outlineEditor.lastActiveNode);
            //滚动到最后
            //outlineEditor.scrollTop = outlineEditor.scrollHeight;
            scrollCenter(newItem);
        }
    };

    // add new item under current node
    // for shift enter
    outlineEditor.createNewChildItem = function (itemText, itemClass='inner-item', itemDataSetIndex=Date.now()) {
        const sel = window.getSelection();

        const liNode = document.activeElement === outlineEditor ? getClosestLiElement(sel.getRangeAt(0).startContainer) : outlineEditor.lastActiveNode;

        if (liNode && liNode.tagName === 'LI') {
            const newItem = document.createElement('li');

            newItem.textContent = '\u200B' + itemText; // Zero-width space
            newItem.classList.add(itemClass);
            newItem.dataset.index = itemDataSetIndex;

	        // 获取已有子元素的最后一个
            var liNode_ul = liNode.children[0];
            if (liNode_ul){ // 在liNode下的ul中增加
                var lastChild = liNode_ul.lastChild;
                liNode_ul.insertBefore(newItem, lastChild.nextSibling);
            } else{ // 如果没有ul，则需要新增加
                const new_ul = document.createElement('ul');
                liNode.appendChild(new_ul);
                new_ul.appendChild(newItem);
            }

            const newRange = document.createRange();
            newRange.setStart(newItem.firstChild, 1);
            newRange.setEnd(newItem.firstChild, 1);
            sel.removeAllRanges();
            sel.addRange(newRange);
            outlineEditor.lastActiveNode = newItem; // 更新lastActiveNode
            //console.log("2 last active node is: ",outlineEditor.lastActiveNode);
            //滚动到新增item
            scrollCenter(newItem);

            return newItem;
        }
    };

    // 获取当前光标所在的node
    outlineEditor.getActiveItem = function (){

        const sel = window.getSelection();
        const liNode = document.activeElement === outlineEditor ? getClosestLiElement(sel.getRangeAt(0).startContainer) : null;

        if(liNode){
            //console.log(liNode);
            return liNode;
        }

    }

    // append newItem method to the outlineEditor element
    // to be used outside 
    outlineEditor.appendNewItem = function (itemText, itemClass='snippet', itemDataSetIndex) {
        outlineEditor.setLastActiveNode();
        const liNode = outlineEditor.lastActiveNode;
        //console.log("li node in outliner is: ",liNode);

        if (liNode && liNode.tagName === 'LI') {
            const newItem = document.createElement('li');

            newItem.textContent = '\u200B' + itemText; // Zero-width space
            newItem.classList.add(itemClass);
            newItem.dataset.index = itemDataSetIndex;

            liNode.parentNode.insertBefore(newItem, liNode.nextSibling);
            outlineEditor.lastActiveNode = newItem; // 更新lastActiveNode
            //滚动到新增item
            outlineEditor.scrollTop = outlineEditor.scrollHeight;
        }
    };

    // 保存item数据
    outlineEditor.saveData = async function () {
        const items = Array.from(editorContainer.querySelectorAll('li'));
        items.shift(); // 去除第一个start time item
        const data = [];

        const calculateIndentLevel = function (item) {
            let level = 0;
            while (item.parentElement && item.parentElement.tagName === 'UL' && item.parentElement !== editorContainer.querySelector('ul')) {
                item = item.parentElement.parentElement;
                level++;
            }
            return level;
        };

        items.forEach((item) => {
            const itemData = {
                // 获取当前 li 元素的直接文本内容，排除子级元素的文本
                text: Array.from(item.childNodes)
                  .filter(node => node.nodeType === Node.TEXT_NODE)
                  .map(
                      //node => node.textContent.trim()
                      // 保存时候去掉...
                      node =>{
                        let content = node.textContent.trim();
                        if (content.startsWith('...')) {
                            content = content.substring(3);
                            //console.log('trim ...');
                        }
                        return content;
                      }
                  )
                  .join(''),
                class: item.className, //string "class1 class2"
                index: item.dataset.index,
                indentLevel: calculateIndentLevel(item),
            };
            //console.log('text is: ', itemData.text);
            //console.log('indent level is: ', itemData.indentLevel);
            data.push(itemData);
        });
    
        // 使用当前页面的 URL 作为存储键
        const storageKey = 'outlinerData_' + window.location.href;
        await localStorage.setItem(storageKey, JSON.stringify(data));
        //console.log('outliner data is now saved.');
    };



    // Add restoreData method to the outlineEditor element
    // 重置数据
     outlineEditor.restoreData = function () {
        //console.log('restore the outliner.');
        const storageKey = 'outlinerData_' + window.location.href;
        //tmp
        //console.log(window.location.href);
        const data = JSON.parse(localStorage.getItem(storageKey) || '[]');
        //console.log("loading data: ", data);
        const ulElement = editorContainer.querySelector('ul');
    
        // 保留 startItem
        const startItem = ulElement.querySelector('.starter');
        ulElement.innerHTML = ''; // 清空ul元素
    
        const createNestedUls = function (level) {
            let ul = document.createElement('ul');
            let currentUl = ul;
    
            for (let i = 1; i < level; i++) {
                const nestedUl = document.createElement('ul');
                currentUl.appendChild(nestedUl);
                currentUl = nestedUl;
            }
    
            return ul;
        };
    
        data.forEach((itemData, index) => {
            const newItem = document.createElement('li');
            newItem.textContent = '\u200B' + itemData.text; // Zero-width space
            const itemClassList = itemData.class.split(' ');
            for(let className of itemClassList){ // add all class
                newItem.classList.add(className); 
            }
            newItem.dataset.index = itemData.index;
    
            let targetUl = ulElement;
    
            if (itemData.indentLevel > 0) {
                const lastItem = data[index - 1] || {};
                const prevItem = ulElement.querySelector(`[data-index="${lastItem.index}"]`);
    
                if (prevItem) {
                    if (itemData.indentLevel === lastItem.indentLevel) {
                        targetUl = prevItem.parentElement;
                    } else if (itemData.indentLevel > lastItem.indentLevel) {
                        const existingUl = prevItem.querySelector('ul');
                        if (existingUl) {
                            targetUl = existingUl;
                        } else {
                            const ulsToCreate = itemData.indentLevel - (lastItem.indentLevel || 0);
                            const nestedUls = createNestedUls(ulsToCreate);
                            prevItem.appendChild(nestedUls);
                            targetUl = nestedUls.querySelector('ul:last-child') || nestedUls;
                        }
                    } else {
                        let parentItem = prevItem;
                        for (let i = 0; i < lastItem.indentLevel - itemData.indentLevel; i++) {
                            parentItem = parentItem.parentElement.parentElement;
                        }
                        targetUl = parentItem.parentElement;
                    }
                }
            }
    
            targetUl.appendChild(newItem);
        });
    
        // 重置 startItem
        if (startItem) {
            const firstItem = ulElement.querySelector('li:first-child');
            if (firstItem) {
                ulElement.insertBefore(startItem, firstItem);
            } else {
                ulElement.appendChild(startItem);
            }
        }
    };   


    // 获得所有的文本
    function processItems(items, indentLevel = 0) {
        let result = '';
      
        items.forEach((item) => {
          // 添加当前层级的制表符
          const indent = '\t'.repeat(indentLevel);
      
          // 获取当前 li 元素的直接文本内容，排除子级元素的文本
          const itemText = Array.from(item.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent.trim())
            .join('');
            
          // 拼接文本和缩进
          result += `${indent}${itemText}\n`;
      
          // 处理子级 li 元素，缩进层级加 1
          const childItems = Array.from(item.children).filter(child => child.tagName === 'UL');
          if (childItems.length > 0) {
            result += processItems(Array.from(childItems[0].children), indentLevel + 1);
          }
        });
      
        return result;
    }

    // 单纯文本输出
    // 包含大纲缩进
    outlineEditor.exportAllItems = function() {
        const topLevelItems = editorContainer.querySelectorAll(':scope > ul > li');
        const itemsText = processItems(topLevelItems);
        return itemsText  
    };

    // Add an indent method to the outlineEditor element
    outlineEditor.indent = function (currentNode, sel, range) {
        if (currentNode.tagName === 'LI') {
            const previousItem = currentNode.previousElementSibling;
            if (previousItem) {
                const nestedList = previousItem.querySelector('ul') || document.createElement('ul');
                previousItem.appendChild(nestedList);
                nestedList.appendChild(currentNode);
                const newRange = document.createRange();

                newRange.setStart(currentNode.firstChild, 1);
                newRange.setEnd(currentNode.firstChild, 1);
                sel.removeAllRanges();
                sel.addRange(newRange);
            }
        }
    };

    // Add an outdent method to the outlineEditor element
    outlineEditor.outdent = function (currentNode, sel, range) {
        if (currentNode.tagName === 'LI') {
            const parentList = currentNode.parentNode;
            if (parentList !== outlineEditor) {
                const grandParentList = parentList.parentNode;
                grandParentList.parentNode.insertBefore(currentNode, grandParentList.nextSibling);   // 插入到grandParent的同级而不是parent, parent是ul 
                //grandParentList.parentNode.insertBefore(currentNode, parentList.nextSibling); // 反向outdent有误
                if (parentList.children.length === 0) {
                    grandParentList.removeChild(parentList);
                }
                const newRange = document.createRange();
                newRange.setStart(currentNode.firstChild, range.startOffset);
                newRange.setEnd(currentNode.firstChild, range.endOffset);
                sel.removeAllRanges();
                sel.addRange(newRange);
            }
        }
    };


    // Add fold method to the outlineEditor element
    outlineEditor.fold = function (currentNode) {
        if (currentNode.tagName === 'LI') {
            const nestedList = currentNode.querySelector('ul');
            if (nestedList) {
                nestedList.style.display = 'none';
                const textNode = currentNode.firstChild;
                if (textNode.nodeType === Node.TEXT_NODE && !textNode.textContent.startsWith('...')) {
                    textNode.textContent = '...' + textNode.textContent;
                }
            }
        }
    };

    // Add unfold method to the outlineEditor element
    outlineEditor.unfold = function (currentNode) {
        if (currentNode.tagName === 'LI') {
            const nestedList = currentNode.querySelector('ul');
            if (nestedList) {
                nestedList.style.display = 'block';
                const textNode = currentNode.firstChild;
                if (textNode.nodeType === Node.TEXT_NODE && textNode.textContent.startsWith('...')) {
                    textNode.textContent = textNode.textContent.substring(3);
                }
            }
        }
    };

    // Check if is chinese input ongoing
    let isComposing = false;
    function checkChineseInput(inputDom) {
        inputDom.addEventListener('compositionstart', function () {
            isComposing = true;
        });
        inputDom.addEventListener('compositionend', function () {
            isComposing = false;
        });
    }
    checkChineseInput(editorContainer);


    // Get the closest 'li' element from the given node
    function getClosestLiElement(node) {
        while (node && node.tagName !== 'LI') {
            node = node.parentElement;
        }
        return node;
    }

    // 设置默认的最后一个active node
    outlineEditor.setLastActiveNode = function(){
        const elements = outlineEditor.querySelectorAll(':scope > li');
        //console.log('from outliner, outlineEditor.querySelectorAll', outlineEditor);
        const lastElement = elements[elements.length - 1];
        outlineEditor.lastActiveNode = lastElement;
        //console.log('from outliner, last node is: ', outlineEditor.lastActiveNode);
    }


    //------------------------------
    // 对于outlineEditor的一些事件侦听
    //------------------------------

    // Add a dblclick event listener to toggle fold and unfold
    // 频率不高，双击另作他用
    /*
    outlineEditor.addEventListener('dblclick', (e) => {
        const currentNode = e.target;
        if (currentNode.tagName === 'LI') {
            const nestedList = currentNode.querySelector('ul');
            if (nestedList && nestedList.style.display !== 'none') {
                outlineEditor.fold(currentNode);
            } else {
                outlineEditor.unfold(currentNode);
            }
        }
    });*/

    // Handle keyboard events for indent, outdent, and new items
    outlineEditor.addEventListener('keydown', (e) => {
        const sel = window.getSelection();
        const range = sel.getRangeAt(0);
        const currentNode = range.startContainer.parentNode;

        if (e.key === 'Tab') {
            e.preventDefault();
            if (shiftKeyPressed) { // Outdent when Shift key is pressed
                outlineEditor.outdent(currentNode, sel, range);
            } else { // Indent when Shift key is not pressed
                outlineEditor.indent(currentNode, sel, range);
            }
        } else if (e.key === 'Enter' && !isComposing) { // Add a new list item on Enter key press
            // isComposing is a tag to check if chinese input is going
            e.preventDefault();
            if (!shiftKeyPressed) { 
                outlineEditor.createNewItem("");
            }
            else{
                outlineEditor.createNewChildItem(""); 
            }
        }
    });

    // dd,p for move items
    // Add cut method to the outlineEditor
    let cut_item = {};
    outlineEditor.addEventListener('keydown', (e) => {
        if (e.key === 'D' && e.ctrlKey) {
            e.preventDefault();
            const selection = window.getSelection();
            const currentNode = getClosestLiElement(selection.anchorNode);
            if (currentNode && currentNode.tagName === 'LI') {
                cut_item = currentNode;
                currentNode.parentNode.removeChild(currentNode);
            }
        }
    });

    // Add paste method
    // paste down
    outlineEditor.addEventListener('keydown', (e) => {
        if (e.key === 'P' && e.ctrlKey) {
            e.preventDefault();
            const selection = window.getSelection();
            const currentNode = getClosestLiElement(selection.anchorNode);
            if (currentNode && currentNode.tagName === 'LI') {
                //console.log(JSON.stringify(cut_item));
                const parentList = currentNode.parentNode;
                parentList.insertBefore(cut_item, currentNode.nextSibling);
            }
        }
    });

    // paste up
    outlineEditor.addEventListener('keydown', (e) => {
        if (e.key === 'O' && e.ctrlKey) {
            e.preventDefault();
            const selection = window.getSelection();
            const currentNode = getClosestLiElement(selection.anchorNode);
            if (currentNode && currentNode.tagName === 'LI') {
                //console.log(JSON.stringify(cut_item));
                const parentList = currentNode.parentNode;
                parentList.insertBefore(cut_item, currentNode);
            }
        }
    });


    // Modify keydown event listener to use Selection API
    outlineEditor.addEventListener('keydown', (e) => {
        if (e.key === 'z' && e.ctrlKey) {
            e.preventDefault();
            console.log("unfold");
            const selection = window.getSelection();
            const currentNode = getClosestLiElement(selection.anchorNode);
            if (currentNode && currentNode.tagName === 'LI') {
                const nestedList = currentNode.querySelector('ul');
                if (nestedList && nestedList.style.display !== 'none') {
                    outlineEditor.fold(currentNode);
                } else {
                    outlineEditor.unfold(currentNode);
                }
            }
        }
    });

    // Add fold all and unfold all by shift+ctr+z

    let checkFoldAll = false;
    outlineEditor.addEventListener('keydown', (e) => {
        if (e.key === 'Z' && e.ctrlKey && e.shiftKey) {
            e.preventDefault();
            // get all li under container
            // editorContainer
            const lis = editorContainer.querySelectorAll("li");

            if(checkFoldAll){
                for(let li of lis) {
                    //console.log(li);
                    outlineEditor.unfold(li);
                }
                checkFoldAll = false;

            }
            else{
                for(let li of lis) {
                    outlineEditor.fold(li);
                }
                checkFoldAll = true;
            }
        }
    });

    // Add a blur event listener to outlineEditor to store the last active li node
    // make the last li in outliner
    outlineEditor.addEventListener('blur', (e) => {
        outlineEditor.setLastActiveNode();
    });

    // Add a paste event listener to handle pasting lists
    // 避免粘贴内容在导出时丢失
    // 使用cmd+shift+v，多行粘贴适用
    outlineEditor.addEventListener('keydown', (e) => {
        if (e.metaKey && e.shiftKey && e.key === 'v') {
          e.preventDefault();
      
          // 获取光标所在元素
          const targetElement = document.getSelection().focusNode.parentElement;
          //console.log(targetElement);
      
          // 创建一个 <ul> 元素
          const ulElement = document.createElement('ul');
      
          // 将系统剪切板中的内容粘贴到 <ul> 中
          navigator.clipboard.readText().then((text) => {
            // 将文本拆分为行
            const lines = text.split('\n');
      
            // 为每行创建一个 <li> 元素
            lines.forEach((line) => {
              const liElement = document.createElement('li');
              liElement.textContent = line;
              ulElement.appendChild(liElement);
            });
          });
      
          // 将 <ul> 元素添加到光标所在元素中
          targetElement.appendChild(ulElement);
        }
      });
      

    // Append the outline editor to the container
    editorContainer.appendChild(outlineEditor);

    // Add the outlineEditor element as a property of the editorContainer element
    editorContainer.outlineEditor = outlineEditor;

    // Apply the 2-space indent to all nested lists
    const nestedListStyle = document.createElement('style');
    nestedListStyle.innerHTML = `
        ul ul {
          padding-left: 1ch;
        }
        ul {
          list-style-position: inside; // Adjust the position of li::marker to inside
        }
        li {
          padding-left: 1px; // Add left padding to display the input cursor
        }
    `;
    document.head.appendChild(nestedListStyle);
2
    return editorContainer;
}

function chatter(){

    //console.log('from chatbox module.');

    // get KEY,URL from chrome storage
    let _API_KEY = '';
    let _API_URL = '';

    // tmp disable
//    chrome.storage.sync.get("API_KEY", ({ API_KEY }) => {
//        _API_KEY = `${ API_KEY }`;
//        //console.log('API key is set to: ', _API_KEY);
//  });
//
//    chrome.storage.sync.get("API_URL", ({ API_URL }) => {
//        _API_URL = `${ API_URL }`;
//        //console.log(`End point is set to: ${_API_URL}`);
//  });

    const ele = {};

    // Create the chat box
    var chatBox = document.createElement('div');
    chatBox.classList.add('chatBox_sd');
    //document.body.appendChild(chatBox);

    // Create the chat log
    var chatLog = document.createElement('div');
    chatLog.contentEditable = 'true'; // 文本可选择的一个变通方法
    chatLog.classList.add('chatLog');
    chatLog.classList.add('chatLog_sd');
    chatBox.appendChild(chatLog);

    // Create the input container
    var inputContainer = document.createElement('div');
    inputContainer.classList.add('inputContainer_sd');
    chatBox.appendChild(inputContainer);

    // Create the clear button
    var clearButton = document.createElement('button');
    clearButton.classList.add('clearButton_sd');
    clearButton.innerHTML = '♲';
    inputContainer.appendChild(clearButton);

    // Create the input box
    var inputBox = document.createElement('textarea');
    inputBox.classList.add('chatInput');
    inputBox.classList.add('inputBox_sd');
    inputContainer.appendChild(inputBox);
    //chatBox.appendChild(inputBox);

    // Create the send button
    var sendButton = document.createElement('button');
    sendButton.classList.add('sendButton_sd');
    sendButton.innerHTML = 'Send';
    inputContainer.appendChild(sendButton);
    //chatBox.appendChild(sendButton);

    // Clear chat history by clearButton
    clearButton.addEventListener('click', function() {
        clearChatHistory();

        // create a segment div
        var clearSeg = document.createElement('div');
        clearSeg.classList.add('seg_sd');
        clearSeg.innerHTML ='--------------new chat----------------';
        chatLog.appendChild(clearSeg);
        chatLog.scrollTop = chatLog.scrollHeight;
    });

    // initial messages
    let messages = [];
    let sys_message = {"role": "system", "content": "Always think in English, but reply in Chinese."};
    messages.push(sys_message);

    function clearChatHistory(){
        messages = [];
        messages.push(sys_message);
    }

    // Add event listener to send button
    sendButton.addEventListener('click', function() {
        var userInput = inputBox.value.trim();
        if (userInput !== '') {
            // Add user message to chat log
            var userMessage = document.createElement('div');
            userMessage.classList.add('userMessage_sd');

            // add span for text wrap
            var userText = document.createElement('span');
            userText.classList.add('userLog');
            userText.classList.add('userText_sd');
            userText.innerHTML = userInput;
            userMessage.appendChild(userText);
            chatLog.appendChild(userMessage);

            // Add bot message to chat log
            var botMessage = document.createElement('div');
            botMessage.classList.add('botMessage_sd');

             // add span for text wrap
            var botText = document.createElement('span');
            botText.classList.add('botLog');
            botText.classList.add('botText_sd');
            botMessage.appendChild(botText);
            chatLog.appendChild(botMessage);

            // update botText
            streamResponse(userInput, botText);

            // Clear the input box
            inputBox.value = '';

            // Scroll to the bottom of the chat log
            chatLog.scrollTop = chatLog.scrollHeight;
        }
    });

    // no stream
    function simpleResponse(question, responseSpan, callback=null){

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${_API_KEY}`,
        };
        
        // 请求体数据，如果有的话
        messages.push({role: "user", content: question});
    
        const requestBody = {
            //model: 'gpt-4',
            model: 'gpt-3.5-turbo',
            messages: messages,
            stream: false,
            temperature: 0.8
        };
        
        // 请求的选项
        const options = {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        };
        
        // 发送请求
        fetch(_API_URL, options)
            .then(response => {
                if (!response.ok) {
                    throw new Error('网络请求失败');
                }
                return response.json();
            })
            .then(responseData => {
                //console.log('响应数据：', responseData);
                // 在这里可以对响应数据进行处理
                const reply = responseData.choices[0].message.content;
                responseSpan.innerHTML = reply;

                // 执行回调函数，如果提供了回调函数
                if (callback && typeof callback === 'function') {
                    callback(reply);
                }

            })
            .catch(error => {
                console.error('请求错误：', error);
            });
    }

    async function asyncSimpleResponse(question, responseSpan=null) {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${_API_KEY}`,
        };
    
        // 请求体数据，如果有的话
        messages.push({ role: "user", content: question });
    
        const requestBody = {
            model: 'gpt-3.5-turbo',
            messages: messages,
            stream: false,
            temperature: 0.8
        };
    
        // 请求的选项
        const options = {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        };
    
        try {
            // 发送请求并等待响应
            const response = await fetch(_API_URL, options);
    
            if (!response.ok) {
                //throw new Error('网络请求失败');
                throw new Error(`HTTP error! status: ${response.status}`);
            }
    
            const responseData = await response.json();
            const reply = responseData.choices[0].message.content;

            if (responseSpan){
                responseSpan.innerHTML = reply;
            }
    
            return reply; // 返回reply值
        } catch (error) {
            //console.error('请求错误：', error);
            //console.error("Simple Fetch error: ", error);
            if (responseSpan){
                responseSpan.innerHTML = 'Simple Fetch error: ' + error.message;
            }
            throw error; // 可以选择抛出错误或采取其他处理方式
        }
    }

    // async stream response
    async function streamResponse(question, responseSpan) {
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${_API_KEY}`,
        };
    
      // 添加用户问题 
      messages.push({role: "user", content: question});
    
      const requestBody = {
        //model: 'gpt-4',
        model: 'gpt-3.5-turbo',
        messages: messages,
        stream: true,
        temperature: 0.8
      };
      
      let responseStr = '';

      fetch(_API_URL, {
        method: 'POST', 
        headers: headers,
        body: JSON.stringify(requestBody)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.body;
      })
      .then(readableStream => {
    
        const reader = readableStream.getReader();
        const decoder = new TextDecoder();
        let partialData = '';
    
        function pump() {
          return reader.read()
            .then(({done, value}) => {
              if(done) {
                return;  
              }
              
              const chunk = decoder.decode(value, {stream: true});
              
              const lines = (partialData + chunk).split('\n');
              partialData = lines.pop();
              
              lines.forEach(line => {
                const match = line.match(/"content":"([^"]*)"/);
                
                if (match) {
                  let text = match[1];
                  text = text.replace(/\\n/g, '&#10;');
                  
                  responseStr += text;
                  //console.log(responseStr);
                  responseSpan.innerHTML = responseStr;
                  
                  chatLog.scrollTop = chatLog.scrollHeight; 
                }
              });
              
              return pump();
            })
        }
        
        return pump();
      
      })
      .then(() => {
        if (responseStr) {
          messages.push({role: 'assistant', content: responseStr}); 
        }
      })
      .catch(error => { // 处理错误
        //console.error("Stream Fetch error: ", error);
        responseSpan.innerHTML = 'Stream Fetch error: ' + error.message;
      });
    }

        
    // Add event listener to input box for "Enter" key
    inputBox.addEventListener('keydown', function(event) {
        if (event.keyCode === 13 && !event.shiftKey) {
            event.preventDefault();
            sendButton.click();
        }
    });

    ele.chatBox = chatBox;
    ele.chatting = streamResponse;
    ele.clearChatHistory = clearChatHistory;
    ele.simpleResponse = simpleResponse;
    ele.replying = asyncSimpleResponse;

    return ele
}
