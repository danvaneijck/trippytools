
import { FaGithub } from "react-icons/fa";
import { FaSquareXTwitter } from "react-icons/fa6";

const Footer = () => {
    return (
        <footer className="bg-gray-800 text-white text-xs p-3 fixed bottom-0 left-0 right-0 flex flex-row justify-between items-center">
            <a
                className="flex flex-row items-center"
                href="https://x.com/trippykiwiPRMR">
                made by @trippykiwi
                <FaSquareXTwitter className="text-xl ml-2" />
            </a>
            <a href="https://github.com/danvaneijck/trippytools">
                <FaGithub className="text-xl" />
            </a>
        </footer>
    )
}

export default Footer