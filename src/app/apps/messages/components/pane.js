"use client"

import MessagesTimestamp from "./timestamp";
import MessagesOther from "./other-message";
import MessagesSelf from "./self-message";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";

import { getCustomState, setCustomState } from "@/app/globals";

const MESSAGE_EXPIRY_MINS = 60 * 6;
const isExpiredTime = (timestamp=new Date(), prevTimestamp=new Date()) => {
    if (timestamp.getFullYear() > prevTimestamp.getFullYear()) return true;
    if (timestamp.getMonth() > prevTimestamp.getMonth()) return true;
    if (timestamp.getDate() > prevTimestamp.getDate()) return true;

    const now = new Date();
    if (timestamp.getMonth() == now.getMonth() && timestamp.getFullYear() == now.getFullYear() && timestamp.getDate() + 1 >= now.getDate()) {
        if ((timestamp.getTime() - prevTimestamp.getTime()) >= (1000 * 60 * MESSAGE_EXPIRY_MINS)) return true;
        else return false;
    }

    return false;
};

export default function MessagesPane({ messages, user, pfp, defaultColor="#16a34a", onChat=(chat)=>{}, loading=false }) {
    const [color, setColor] = useState(defaultColor);
    const [offline, setOffline] = useState(false);
    const output = [];
    let lastTimestamp = null;

    // Remap messages into components
    for (const { username, message, timestamp } of messages) {
        if (!lastTimestamp || isExpiredTime(timestamp, lastTimestamp))
            output.push(<MessagesTimestamp datetime={timestamp} key={output.length} />);

        if (username == "You")
            output.push(<MessagesSelf key={output.length} message={message} />);
        else
            output.push(<MessagesOther username={user} key={output.length} message={message} />);

        lastTimestamp = timestamp;
    }

    // Chat input ref
    const chatInput = useRef(null);
    const colorInput = useRef(null);

    // Disable certain keyboard shortcuts in chatbox
    async function disableShortcuts(event) {
        if (event.key.toUpperCase() == "ARROWUP") {
            event.preventDefault();

            const lastMessage = messages.filter(e => e.username == "You").at(-1);
            if (lastMessage) {
                chatInput.current.innerText = lastMessage.message;

                // Move caret to end
                const range = document.createRange();
                range.selectNodeContents(chatInput.current);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }

            return;
        }

        if (event.key.toUpperCase() == "ENTER" && !event.shiftKey) {
            event.preventDefault();
            onSubmitChat();
            return;
        }

        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();

        // Custom copy
        if (event.key.toUpperCase() == "C") {
            try {
                const selection = window.getSelection();
                const clipboardText = selection.toString();
                await navigator.clipboard.writeText(clipboardText);
            }
            catch (_err) {
                // Ignore; no permission to copy
            }
        }

        // Custom paste
        if (event.key.toUpperCase() == "V") {
            try {
                const clipboardText = await navigator.clipboard.readText();
                const selection = window.getSelection();
                selection.getRangeAt(0).insertNode(document.createTextNode(clipboardText));
            }
            catch (_err) {
                // Ignore; no permission to paste
            }
        }
    }

    // Callback on submitting chat
    function onSubmitChat() {
        if (!chatInput.current.innerText?.trim()?.length) return;

        onChat(chatInput.current.innerText);
        chatInput.current.innerHTML = "";
    }

    // Changing color
    function setNewColor() {
        setCustomState("sos_messages_color_" + user, { color: colorInput.current.value });
        setColor(colorInput.current.value);
    }

    // On render:
    useEffect(() => {
        // Scroll to bottom of messages
        document.documentElement.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "smooth"
        });

        // Import saved custom color
        const localColor = getCustomState("sos_messages_color_" + user)?.color ?? defaultColor;
        setColor(localColor);

        // Locally save custom color
        const onUnload = () => {
            setCustomState("sos_messages_color_" + user, { color });
        };
        window.addEventListener("beforeunload", onUnload);

        // Determine internet connection status
        async function isOnline() {
            let status;

            try {
                await fetch("https://google.com", { mode: "no-cors", signal: AbortSignal.timeout(2800) });

                // If any response, we are most likely connected
                status = true;
            }
            catch (_err) {
                // If any error, we are most likely not connected
                status = false;
            }

            if (status == offline)
                setOffline(!status);
        }
        isOnline();
        const onlineChecker = setInterval(isOnline, 3000);

        return () => {
            window.removeEventListener("beforeunload", onUnload);
            clearInterval(onlineChecker);
        };
    });

    return (
        <div className="w-full min-h-screen h-auto bg-gray-950 relative flex flex-col" style={{"--sos-self-msg": color }}>
            <div className="w-full p-3 bg-gray-700/20 backdrop-blur-md sticky top-0 self-start flex flex-row items-center justify-center z-10">
                <a href="/apps/messages" className="p-3 text-blue-500 hover:text-blue-400 cursor-pointer">
                    &#x2B9C;
                </a>
                <div className="grow"></div>
                <div className="flex flex-col">
                    <img width={64} height={64} src={`/user-pfps/${pfp}.jpg`} className="w-16 h-16 p-2 rounded-full" alt="Main avatar" loading="lazy" />
                    <p className="w-full text-center text-xs">{user}</p>
                </div>
                <div className="grow"></div>
                <div className="p-3 invisible">&#x2B9C;</div>
                <button className="absolute right-6 text-base p-1 rounded-full bg-transparent border-[--sos-self-msg] border-2" onClick={() => colorInput.current.click()}>
                    &#127912;
                    <input type="color" value={color} className="invisible w-0 h-0 absolute bottom-0 right-1/2" ref={colorInput} onInput={setNewColor} />
                </button>
            </div>
            <div className="w-full h-full py-3 px-2 sm:px-6 flex flex-col grow overflow-y-visible">
                {output}
                {
                    offline ? <MessagesOther offline={true} username={user} />
                    : (loading ? <MessagesOther loading={true} username={user} /> : "")
                }
            </div>
            <div className="w-full p-3 bg-gray-950/20 backdrop-blur-md sticky bottom-0 self-start flex flex-row items-center justify-center z-10">
                <div className="bg-gray-950 flex flex-row border-gray-800 border-2 rounded-3xl relative max-w-sm lg:max-w-md xl:max-w-lg w-full min-h-9">
                    <div contentEditable={!loading && !offline} suppressContentEditableWarning="true" className="bg-gray-950 rounded-3xl pl-2 pr-8 w-full flex flex-col justify-center flex-grow outline-none peer empty:after:content-['Message'] empty:after:pointer-events-none empty:after:text-gray-500 empty:[line-height:1.85rem]" ref={chatInput} onKeyDown={disableShortcuts}></div>
                    <button className="p-1 bg-[--sos-self-msg] absolute right-1 top-1/2 -translate-y-1/2 rounded-full text-lg font-bold h-6 w-6 flex items-center justify-center [line-height:0] peer-empty:opacity-0 peer-empty:pointer-events-none transition-opacity duration-200" onClick={onSubmitChat}>
                        &#x1F869;
                    </button>
                </div>
            </div>
        </div>
    );
}