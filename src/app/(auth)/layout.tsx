import { BrandMark } from "@/components/sidebar";

export const instant = false;

const POINTS = [
  "Ghi một câu, AI tự xếp thành việc có hạn chót",
  "Bản tin mỗi sáng: hôm nay nên làm gì trước",
  "Trợ lý đọc và cập nhật được công việc của bạn",
];

/** Khối hình nghệ thuật bên phải: các dải sóng xanh vẽ bằng CSS */
function Artwork() {
  return (
    <div
      className="relative h-full overflow-hidden rounded-3xl"
      style={{ background: "linear-gradient(160deg, #a9d4ff 0%, #4b9bff 38%, #1f6fe5 70%, #0f4fc4 100%)" }}
    >
      {[
        { size: 820, top: "-18%", left: "18%", rot: -18, a: 0.55 },
        { size: 680, top: "8%", left: "-22%", rot: 24, a: 0.45 },
        { size: 760, top: "38%", left: "28%", rot: -8, a: 0.5 },
        { size: 520, top: "58%", left: "-12%", rot: 32, a: 0.4 },
      ].map((w, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="absolute rounded-[42%]"
          style={{
            width: w.size,
            height: w.size,
            top: w.top,
            left: w.left,
            transform: `rotate(${w.rot}deg)`,
            border: `2px solid rgba(255,255,255,${w.a * 0.6})`,
            background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,${w.a * 0.35}), rgba(42,133,255,0) 60%)`,
            boxShadow: `inset 0 0 120px rgba(10,60,170,${w.a})`,
          }}
        />
      ))}
      <div className="absolute inset-x-0 bottom-0 p-10 text-white">
        <p className="max-w-md text-3xl font-bold leading-tight tracking-tight">Mọi việc của bạn ở một nơi, có AI kề bên.</p>
        <ul className="mt-6 space-y-2.5 text-[15px] text-white/85">
          {POINTS.map((p) => (
            <li key={p} className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen bg-card p-4 sm:p-6">
      <section className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-[380px] px-2 sm:px-8 xl:max-w-[450px]">
          <div className="mb-8">
            <BrandMark size="lg" />
          </div>
          {children}
        </div>
      </section>
      <section className="hidden max-w-[520px] flex-1 lg:block 2xl:max-w-[720px]">
        <Artwork />
      </section>
    </main>
  );
}
