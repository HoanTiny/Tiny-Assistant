import { ExternalLink, Send, Unlink } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getBotUsername, linkCode, listLinkedChats, telegramToken } from "@/lib/telegram";
import { Badge, Card, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { unlinkTelegram } from "./actions";
import { TelegramTestButton } from "./telegram-test-button";

const COMMANDS = [
  ["Nhắn một câu bất kỳ", "AI ghi thành công việc hoặc ghi chú, như ô Ctrl+K"],
  ["/viec", "Việc quá hạn, hôm nay và đang làm"],
  ["/bantin", "Bản tin sáng hôm nay"],
  ["Tự động", "Bản tin sáng và tổng kết tuần được gửi về lúc app tạo xong"],
];

/** Thẻ kết nối Telegram trên trang Kết nối */
export async function TelegramCard() {
  const user = await requireUser();
  const token = telegramToken();

  let bot: string | null = null;
  let botError: string | null = null;
  if (token) {
    try {
      bot = await getBotUsername();
    } catch (err) {
      botError = err instanceof Error ? err.message : "Không kết nối được Telegram";
    }
  }
  const chats = token ? await listLinkedChats(user.workspaceId) : [];
  const code = linkCode(user.workspaceId);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-neutral-900" aria-hidden="true">
            <Send size={20} />
          </span>
          <div>
            <h2 className="text-lg font-bold">Telegram</h2>
            <p className="text-sm text-muted-foreground">Nhận bản tin sáng trên điện thoại, nhắn bot để ghi việc nhanh.</p>
          </div>
        </div>
        {chats.length > 0 ? (
          <Badge tone="success">Đã kết nối {chats.length} chat</Badge>
        ) : bot ? (
          <Badge tone="warning">Chưa liên kết chat</Badge>
        ) : (
          <Badge>Chưa thiết lập</Badge>
        )}
      </div>

      {!token && (
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-foreground">
          <li>
            Trên Telegram, nhắn cho <b>@BotFather</b>, gửi <code className="rounded bg-field px-1">/newbot</code> và đặt tên cho bot.
          </li>
          <li>BotFather gửi lại một token dạng <code className="rounded bg-field px-1">123456:ABC...</code>.</li>
          <li>
            Dán token vào file <code className="rounded bg-field px-1">.env.local</code> (trên VPS là{" "}
            <code className="rounded bg-field px-1">.env</code>):{" "}
            <code className="rounded bg-field px-1">TELEGRAM_BOT_TOKEN=...</code>
          </li>
          <li>Khởi động lại app, rồi quay lại trang này để liên kết.</li>
        </ol>
      )}

      {token && botError && (
        <p className="mt-5 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">
          Không kết nối được bot: {botError}. Kiểm tra lại TELEGRAM_BOT_TOKEN.
        </p>
      )}

      {bot && (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-semibold text-muted-foreground">Liên kết chat của bạn</div>
            <p className="text-sm text-foreground">
              Bấm nút dưới đây, Telegram sẽ mở bot <b>@{bot}</b>. Bấm <b>Start</b> là xong.
            </p>
            <a
              href={`https://t.me/${bot}?start=${code}`}
              target="_blank"
              rel="noreferrer"
              className={buttonClass("primary", "sm", "mt-3")}
            >
              Mở @{bot} và liên kết <ExternalLink size={14} />
            </a>
            <p className="mt-3 text-xs text-muted-foreground">
              Hoặc tự gửi cho bot: <code className="rounded bg-field px-1 font-semibold">/start {code}</code>. Giữ kín mã này:
              ai có mã cũng liên kết được với WorkHub của bạn.
            </p>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-muted-foreground">Bot làm được gì</div>
            <ul className="space-y-1.5 text-sm">
              {COMMANDS.map(([k, v]) => (
                <li key={k}>
                  <span className="font-semibold text-foreground">{k}</span>
                  <span className="text-muted-foreground">: {v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {chats.length > 0 && (
        <div className="mt-5 border-t pt-4">
          <div className="mb-2 text-sm font-semibold text-muted-foreground">Chat đã liên kết</div>
          <ul className="divide-y">
            {chats.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground">Liên kết lúc {formatDateTime(c.linkedAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <TelegramTestButton integrationId={c.id} />
                  <form action={unlinkTelegram.bind(null, c.id)}>
                    <button type="submit" className={buttonClass("ghost", "xs", "hover:text-danger")}>
                      <Unlink size={13} /> Ngắt kết nối
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
