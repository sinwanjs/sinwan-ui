import { Show } from "sinwan";
import { signal, cc, For, onUpdated } from "sinwan";
import { useState } from "sinwan/react-client";
import { useEffect } from "sinwan/react-client";

export type Country = {
  name: string;
  code: string;
  capital: string;
  population: number;
  region: string;
  currency: string;
};

export type CountriesResponse = {
  countries: Country[];
};

const Test = cc<{ count: () => number }>(({ count }) => {
  return (
    <div>
      <h1>test app {count}</h1>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipisicing elit. Temporibus,
        incidunt.
      </p>
    </div>
  );
});

export const Counter = cc(async () => {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([1, 2, 3]);
  const test = signal(1);
  useEffect(() => {
    console.log("count from useEffect", count());
  }, [() => test.value]);

  onUpdated(() => {
    console.log("onUpdated", count());
  });

  const response = await fetch("http://localhost:3002/countries", {
    method: "GET",
  });

  const countries: CountriesResponse = await response.json();

  console.log(countries);

  const handleClick = () => {
    console.log("count", count());
    console.log("items", items());
    setItems([...items(), items().length + 1]);
    setCount(count() + 1);
    test.value++;
  };

  const handleReset = () => {
    setCount(0);
    setItems([]);
  };

  return (
    <div class="counter">
      <Test count={count} />
      <p>You clicked the button {count} times.</p>
      <button onClick={handleClick}>Increment</button>
      <button onClick={handleReset}>Reset</button>
      <Show when={countries}>
        <CountryList countries={countries.countries} />
      </Show>
      {Array.from({ length: -110 }, (_, i) => (
        <h1 key={i}>{i}</h1>
      ))}
    </div>
  );
});

const CountryList = cc<{
  countries: Country[];
}>(({ countries }) => {
  return <For each={countries}>{(country) => <div>{country.name}</div>}</For>;
});
