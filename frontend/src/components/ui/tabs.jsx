import React, { useState } from "react";

export function Tabs({ children, defaultValue }) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  // Extrae TabsTrigger y TabsContent
  const triggers = [];
  const contents = [];

  React.Children.forEach(children, (child) => {
    if (child.type === TabsList) {
      triggers.push(React.cloneElement(child, { activeTab, setActiveTab }));
    } else if (child.type === TabsContent) {
      contents.push(child);
    }
  });

  return (
    <div className="w-full">
      {triggers}
      {contents.map((child) =>
        child.props.value === activeTab ? child : null
      )}
    </div>
  );
}

export function TabsList({ children, activeTab, setActiveTab }) {
  return (
    <div className="flex gap-4 justify-center">
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { activeTab, setActiveTab })
      )}
    </div>
  );
}

export function TabsTrigger({ value, children, activeTab, setActiveTab }) {
  const isActive = value === activeTab;
  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`w-16 px-2 py-3 text-xs border-md transition text-center
        ${isActive ? "bg-blue-900 text-white font-semibold" : "bg-neutral-200 font-semibold text-black dark:bg-neutral-700 dark:text-white"}`}
    >
      {children}
    </button>
  );
}


export function TabsContent({ children }) {
  return <div className="mt-4">{children}</div>;
}


