
export async function asyncWrapper<T>(promises: Promise<T>): Promise<{data?:T, error?: Error}>{
	const results:PromiseSettledResult<Awaited<T>>[] = await Promise.allSettled([promises])
	const [settledResult] = results;
	if (settledResult.status === 'fulfilled') return {data: settledResult.value};
	// console.log(settledResult.reason);
	return {error: settledResult.reason};
}
