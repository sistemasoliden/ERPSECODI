// src/components/SkeletonRucCard.jsx
export default function SkeletonRucCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 min-h-[320px] animate-pulse">
      <div className="mb-3 grid grid-cols-[1fr_220px] items-start gap-4">
        <div className="min-w-0 px-2">
          <div className="h-5 w-28 bg-gray-100 rounded mb-2" />
          <div className="h-4 w-40 bg-gray-100 rounded" />
        </div>
        <div className="w-[220px] -ml-[12px] flex flex-col gap-2">
          <div className="h-6 bg-gray-100 rounded" />
          <div className="h-6 bg-gray-100 rounded" />
        </div>
      </div>

      <div className="p-3">
        <div className="flex gap-4">
          <div className="w-40 shrink-0 flex flex-col gap-2">
            <div className="h-7 bg-gray-100 rounded" />
            <div className="h-7 bg-gray-100 rounded" />
          </div>
          <div className="grid grid-cols-4 gap-2 flex-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded" />
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="h-4 w-44 bg-gray-100 rounded mb-2" />
          {/* panel SF con misma altura mínima que el real */}
          <div className="grid grid-cols-[minmax(0,1fr)_176px] gap-4">
            <div className="rounded-md border border-gray-100 p-2 min-h-[140px]">
              <div className="grid gap-3 grid-cols-3">
                <div className="h-12 bg-gray-100 rounded" />
                <div className="h-12 bg-gray-100 rounded" />
                <div className="h-[112px] bg-gray-100 rounded" />
                <div className="h-12 bg-gray-100 rounded" />
                <div className="h-12 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="w-[176px] mx-auto sm:mx-0 flex flex-col gap-2">
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
