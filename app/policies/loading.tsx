import { Header } from "@/components/Header";

function SkeletonCard() {
  return (
    <div className="animate-pulse panel px-4 py-3 motion-reduce:animate-none">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-edge-strong" />
        <div className="h-3 w-16 rounded-sm bg-edge" />
        <div className="h-3 w-40 rounded-sm bg-edge" />
      </div>
      <div className="mt-3 h-2 w-56 rounded-sm bg-edge" />
      <div className="mt-2 h-2 w-full max-w-xl rounded-sm bg-edge" />
    </div>
  );
}

export default function PoliciesLoading() {
  return (
    <>
      <Header />
      <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <div className="h-3 w-24 animate-pulse rounded-sm bg-edge motion-reduce:animate-none" />
        <div className="mt-3 h-7 w-64 animate-pulse rounded-sm bg-edge motion-reduce:animate-none" />
        <div className="mt-3 h-4 w-full max-w-lg animate-pulse rounded-sm bg-edge motion-reduce:animate-none" />
        <div className="mt-6 h-16 animate-pulse panel motion-reduce:animate-none" />
        <div className="mt-6 space-y-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </>
  );
}
